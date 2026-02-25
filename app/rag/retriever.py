"""
RAG retriever — wraps OCI PostgreSQL PGVector as a LangChain Tool.

The vectorstore connection is cached at the Streamlit server-process level
(@st.cache_resource) so all user sessions share one DB connection pool.
"""

import streamlit as st
from langchain_postgres import PGVector
from langchain_core.tools import Tool
from langchain_core.documents import Document

from oci_llm import build_embeddings
from config import PG_CONNECTION_STRING, PG_COLLECTION_NAME, RAG_TOP_K


@st.cache_resource
def _get_vectorstore() -> PGVector:
    """
    Open the PGVector collection once per server process.
    Cached — not recreated on every Streamlit re-run or per-user session.
    """
    if not PG_CONNECTION_STRING:
        raise ValueError(
            "PG_CONNECTION_STRING is not set. "
            "Run the ingest script after configuring your OCI PostgreSQL connection."
        )
    return PGVector(
        embeddings=build_embeddings(),
        collection_name=PG_COLLECTION_NAME,
        connection=PG_CONNECTION_STRING,
        use_jsonb=True,
    )


def build_rag_tool() -> Tool:
    """
    Build and return the search_runbooks LangChain Tool.
    This tool is passed to the LangGraph agent alongside MCP vCenter tools.

    The description is what the LLM reads to decide when to call this tool —
    keep it precise and distinct from vCenter tool descriptions.
    """
    vectorstore = _get_vectorstore()
    retriever   = vectorstore.as_retriever(search_kwargs={"k": RAG_TOP_K})

    def search_runbooks(query: str) -> str:
        """
        Search the vCenter operational runbooks and documentation.
        Returns relevant excerpts from runbooks, procedures, and guides.
        """
        try:
            docs: list[Document] = retriever.invoke(query)
        except Exception as e:
            return f"Runbook search unavailable: {e}"

        if not docs:
            return "No relevant runbook content found for this query."

        results = []
        for i, doc in enumerate(docs, 1):
            source = doc.metadata.get("source", "unknown")
            page   = doc.metadata.get("page", "")
            loc    = f" (page {page + 1})" if isinstance(page, int) else ""
            results.append(f"[Source {i}: {source}{loc}]\n{doc.page_content}")

        return "\n\n---\n\n".join(results)

    return Tool(
        name="search_runbooks",
        func=search_runbooks,
        description=(
            "Search the vCenter operational runbooks, procedures, and documentation. "
            "Use this for questions about DR procedures, troubleshooting steps, "
            "SLAs, maintenance windows, escalation paths, or any operational guidance. "
            "For live vCenter state (power status, resource usage, alarms), "
            "use the vCenter tools instead. "
            "Input: a natural language query about vCenter operations or procedures."
        ),
    )
