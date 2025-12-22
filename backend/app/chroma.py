import chromadb

from app.config import settings


COLLECTION_NAME = "study_cards"


def get_collection():
    client = chromadb.PersistentClient(path=settings.chroma_path)
    return client.get_or_create_collection(COLLECTION_NAME)
