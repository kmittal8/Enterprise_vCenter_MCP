"""
RAG document ingestion pipeline.

Loads PDF and Markdown runbooks from RUNBOOKS_DIR, chunks them,
embeds them using OCI GenAI Cohere, and stores them in OCI PostgreSQL
via pgvector (langchain-postgres PGVector).

Usage:
  python -m rag.ingest                    # from app/ directory
  docker exec -it vcenter_app python -m rag.ingest
"""

import sys
import hashlib
from pathlib import Path

from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_postgres import PGVector
from langchain_core.documents import Document

from oci_llm import build_embeddings
from config import (
    PG_CONNECTION_STRING,
    PG_COLLECTION_NAME,
    RAG_CHUNK_SIZE,
    RAG_CHUNK_OVERLAP,
    RUNBOOKS_DIR,
)

BATCH_SIZE = 64  # conservative batch size for OCI embed API rate limits


def load_documents(directory: str) -> list[Document]:
    """
    Recursively load all .pdf and .md/.txt files from the given directory.
    Returns a flat list of LangChain Document objects.
    """
    docs = []
    base = Path(directory)

    if not base.exists():
        print(f"Warning: runbooks directory not found at {directory}")
        return docs

    for path in sorted(base.rglob("*.pdf")):
        try:
            loader = PyPDFLoader(str(path))
            pages = loader.load()
            docs.extend(pages)
            print(f"  Loaded {len(pages)} pages from {path.name}")
        except Exception as e:
            print(f"  Warning: could not load {path.name}: {e}")

    for path in sorted(base.rglob("*.md")):
        try:
            loader = TextLoader(str(path), encoding="utf-8")
            pages = loader.load()
            docs.extend(pages)
            print(f"  Loaded {len(pages)} page(s) from {path.name}")
        except Exception as e:
            print(f"  Warning: could not load {path.name}: {e}")

    for path in sorted(base.rglob("*.txt")):
        try:
            loader = TextLoader(str(path), encoding="utf-8")
            pages = loader.load()
            docs.extend(pages)
            print(f"  Loaded {len(pages)} page(s) from {path.name}")
        except Exception as e:
            print(f"  Warning: could not load {path.name}: {e}")

    return docs


def chunk_documents(docs: list[Document]) -> tuple[list[Document], list[str]]:
    """
    Split documents into overlapping chunks.
    Returns (chunks, ids) where each id is a stable hash of the content —
    allowing safe re-ingest without duplicates.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=RAG_CHUNK_SIZE,
        chunk_overlap=RAG_CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_documents(docs)

    # Stable content-hash IDs for idempotent upsert
    ids = [
        hashlib.md5(chunk.page_content.encode()).hexdigest()
        for chunk in chunks
    ]
    return chunks, ids


def build_vectorstore() -> PGVector:
    """Connect to (or create) the PGVector collection in OCI PostgreSQL."""
    if not PG_CONNECTION_STRING:
        raise ValueError(
            "PG_CONNECTION_STRING is not set. "
            "Add it to your .env file or environment.\n"
            "Format: postgresql+psycopg://user:password@host:5432/dbname"
        )
    return PGVector(
        embeddings=build_embeddings(),
        collection_name=PG_COLLECTION_NAME,
        connection=PG_CONNECTION_STRING,
        use_jsonb=True,   # store metadata as JSONB for efficient filtering
    )


def run_ingest():
    """Main entry point for the ingest pipeline."""
    print(f"\nLoading documents from: {RUNBOOKS_DIR}")
    docs = load_documents(RUNBOOKS_DIR)

    if not docs:
        print("\nNo documents found. Drop PDF or Markdown files into the runbooks/ directory.")
        sys.exit(0)

    print(f"\nLoaded {len(docs)} document pages total.")

    chunks, ids = chunk_documents(docs)
    print(f"Split into {len(chunks)} chunks (size={RAG_CHUNK_SIZE}, overlap={RAG_CHUNK_OVERLAP}).")

    print(f"\nConnecting to OCI PostgreSQL (collection: {PG_COLLECTION_NAME})...")
    vectorstore = build_vectorstore()

    print(f"Upserting chunks in batches of {BATCH_SIZE}...")
    for i in range(0, len(chunks), BATCH_SIZE):
        batch_chunks = chunks[i : i + BATCH_SIZE]
        batch_ids    = ids[i : i + BATCH_SIZE]
        vectorstore.add_documents(documents=batch_chunks, ids=batch_ids)
        end = min(i + BATCH_SIZE, len(chunks))
        print(f"  Upserted {end}/{len(chunks)} chunks")

    print(f"\nIngest complete. {len(chunks)} chunks stored in '{PG_COLLECTION_NAME}'.")


if __name__ == "__main__":
    run_ingest()
