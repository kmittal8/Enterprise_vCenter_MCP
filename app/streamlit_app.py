"""
Enterprise vCenter AI Assistant — Streamlit chat UI.

Accessible from any browser. No Claude Desktop required.
Powered by OCI GenAI (Cohere Command A) + LangChain + vCenter MCP tools + RAG.
"""

import os
import streamlit as st
import nest_asyncio

# Must be applied before any async operations (Tornado event loop is already running)
nest_asyncio.apply()

from agent import get_mcp_tools, build_agent, invoke_agent
from config import APP_TITLE, MAX_CHAT_HISTORY

# ── Page config ────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title=APP_TITLE,
    page_icon="🖥️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Agent initialisation (once per server process, shared across all sessions) ─

@st.cache_resource(show_spinner="Connecting to vCenter MCP server...")
def get_agent():
    """
    Build the LangGraph agent once per server process.
    Fetches MCP tool schemas from the running mcp_server container.
    Returns (agent, error_message).
    """
    try:
        mcp_tools = get_mcp_tools()
        agent     = build_agent(mcp_tools)
        return agent, None
    except Exception as e:
        return None, str(e)


# ── Session state ──────────────────────────────────────────────────────────────

def init_session():
    if "messages" not in st.session_state:
        st.session_state.messages = []   # [{"role": "user"|"assistant", "content": str}]


# ── Sidebar ────────────────────────────────────────────────────────────────────

def render_sidebar():
    with st.sidebar:
        # Oracle logo
        logo_path = os.path.join(os.path.dirname(__file__), "assets", "oracle_logo.png")
        if os.path.exists(logo_path):
            st.image(logo_path, width=160)
        else:
            st.markdown("### ORACLE")   # text fallback if logo not yet placed

        st.markdown("---")
        st.markdown(f"### {APP_TITLE}")
        st.markdown("AI-powered vCenter operations assistant.")
        st.markdown("---")

        st.markdown("**Powered by**")
        st.markdown("- OCI GenAI · Cohere Command A")
        st.markdown("- VMware vCenter MCP")
        st.markdown("- LangChain + LangGraph")
        st.markdown("- OCI PostgreSQL · pgvector RAG")

        st.markdown("---")
        st.markdown("**Ask about:**")
        st.markdown("- VM / host / datastore status")
        st.markdown("- Alarms and performance")
        st.markdown("- DR and runbook procedures")
        st.markdown("- Snapshot management")

        st.markdown("---")
        if st.button("🗑️ Clear Chat", use_container_width=True):
            st.session_state.messages = []
            st.rerun()


# ── Main UI ────────────────────────────────────────────────────────────────────

def main():
    init_session()
    render_sidebar()

    st.title(f"🖥️ {APP_TITLE}")

    # Load agent (cached — no rebuild on re-run)
    agent, error = get_agent()
    if error:
        st.error(f"**Failed to connect to vCenter MCP server**\n\n{error}")
        st.info(
            "Ensure the `mcp_server` container is running and healthy.\n"
            "Check: `docker compose ps` and `docker compose logs mcp_server`"
        )
        st.stop()

    # Render existing chat history
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    # Chat input
    if user_input := st.chat_input("Ask about your vCenter environment or runbooks..."):

        # Display user message immediately
        with st.chat_message("user"):
            st.markdown(user_input)
        st.session_state.messages.append({"role": "user", "content": user_input})

        # Build history list for agent (role, content) pairs, trimmed
        history_pairs = [
            (m["role"], m["content"])
            for m in st.session_state.messages[-(MAX_CHAT_HISTORY + 1):-1]
        ]

        # Invoke agent
        with st.chat_message("assistant"):
            with st.spinner("Thinking..."):
                try:
                    response = invoke_agent(agent, user_input, history_pairs)
                except Exception as e:
                    response = f"⚠️ Agent error: {e}"

            st.markdown(response)

        st.session_state.messages.append({"role": "assistant", "content": response})


if __name__ == "__main__":
    main()
