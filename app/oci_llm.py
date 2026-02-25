"""
OCI GenAI factory functions for LLM and embeddings.

Auth strategy:
  - OCI Compute VM (production): INSTANCE_PRINCIPAL — no credentials needed,
    VM identity is granted GenAI access via IAM dynamic group + policy.
  - Local dev: API_KEY — reads ~/.oci/config automatically.
"""

from langchain_community.chat_models.oci_generative_ai import ChatOCIGenAI
from langchain_community.embeddings import OCIGenAIEmbeddings

from config import (
    OCI_AUTH_TYPE,
    OCI_GENAI_ENDPOINT,
    COMPARTMENT_ID,
    LLM_MODEL_ID,
    EMBED_MODEL_ID,
    LLM_TEMPERATURE,
    LLM_MAX_TOKENS,
)


def _auth_type() -> str:
    """
    Return the auth_type string expected by LangChain OCI integrations.
    Must be uppercase — the LangChain OCI wrappers are case-sensitive.
    """
    if OCI_AUTH_TYPE.lower() == "instance_principal":
        return "INSTANCE_PRINCIPAL"
    return "API_KEY"


def build_llm() -> ChatOCIGenAI:
    """
    Build and return the OCI GenAI chat model (Cohere Command A).
    Cohere Command A supports OAI-compatible tool calling,
    which is required for LangGraph create_react_agent.
    """
    return ChatOCIGenAI(
        auth_type=_auth_type(),
        model_id=LLM_MODEL_ID,
        compartment_id=COMPARTMENT_ID,
        service_endpoint=OCI_GENAI_ENDPOINT,
        model_kwargs={
            "temperature": LLM_TEMPERATURE,
            "max_tokens":  LLM_MAX_TOKENS,
        },
    )


def build_embeddings() -> OCIGenAIEmbeddings:
    """
    Build and return the OCI GenAI embeddings model (Cohere Multilingual v3).
    truncate='END' handles chunks that slightly exceed the model's token limit.
    """
    return OCIGenAIEmbeddings(
        auth_type=_auth_type(),
        model_id=EMBED_MODEL_ID,
        service_endpoint=OCI_GENAI_ENDPOINT,
        compartment_id=COMPARTMENT_ID,
        truncate="END",
    )
