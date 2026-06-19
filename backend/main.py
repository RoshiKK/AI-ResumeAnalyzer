"""
Resume Classifier API
FastAPI backend that loads a fine-tuned DistilBERT model
and predicts job categories from resume text.
"""

import io
import json
import os
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional

import torch
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import PyPDF2
import docx

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
MODEL_DIR = Path(__file__).resolve().parent.parent / "ai-model"

# ---------------------------------------------------------------------------
# Global model / tokenizer references (populated on startup)
# ---------------------------------------------------------------------------
model: Optional[AutoModelForSequenceClassification] = None
tokenizer: Optional[AutoTokenizer] = None
label_map: dict[int, str] = {}
device: torch.device = torch.device("cpu")


# ---------------------------------------------------------------------------
# Lifespan — load model once at startup
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, tokenizer, label_map, device

    print(f"[*] Loading model from {MODEL_DIR} ...")

    # Load label map (str keys → int keys)
    with open(MODEL_DIR / "label_map.json", "r", encoding="utf-8") as f:
        raw = json.load(f)
        label_map = {int(k): v for k, v in raw.items()}

    # Pick device
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[*] Using device: {device}")

    # Load tokenizer & model
    tokenizer = AutoTokenizer.from_pretrained(str(MODEL_DIR), local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(str(MODEL_DIR), local_files_only=True)
    model.to(device)
    model.eval()

    print(f"[OK] Model loaded - {len(label_map)} categories")
    yield  # app runs here
    print("[*] Shutting down ...")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Resume Classifier API",
    description="Predict job category from resume text using a fine-tuned DistilBERT model.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class PredictRequest(BaseModel):
    text: str = Field(
        ...,
        min_length=20,
        description="The resume text to classify. Must be at least 20 characters.",
    )


class CategoryScore(BaseModel):
    category: str
    confidence: float


class PredictResponse(BaseModel):
    predicted_category: str
    confidence: float
    top_categories: list[CategoryScore]
    extracted_text: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health", tags=["Health"])
async def health_check():
    """Check that the API and model are ready."""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "device": str(device),
        "categories": len(label_map),
    }


# ---------------------------------------------------------------------------
# Shared inference helper
# ---------------------------------------------------------------------------
def classify_text(text: str) -> PredictResponse:
    """Run model inference on the given text and return structured results."""
    if model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="Model is not loaded yet.")

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=512,
    )
    inputs = {k: v.to(device) for k, v in inputs.items()}

    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits

    probs = torch.nn.functional.softmax(logits, dim=-1).squeeze()

    scored = []
    for idx in range(len(probs)):
        cat_name = label_map.get(idx, f"UNKNOWN_{idx}")
        scored.append(CategoryScore(category=cat_name, confidence=round(probs[idx].item(), 4)))

    scored.sort(key=lambda x: x.confidence, reverse=True)

    return PredictResponse(
        predicted_category=scored[0].category,
        confidence=scored[0].confidence,
        top_categories=scored[:5],
    )


# ---------------------------------------------------------------------------
# File text extraction helper
# ---------------------------------------------------------------------------
ALLOWED_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
}
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}


def extract_text_from_file(filename: str, content: bytes) -> str:
    """Extract plain text from a PDF, DOCX, or TXT file."""
    ext = Path(filename).suffix.lower()

    if ext == ".pdf":
        reader = PyPDF2.PdfReader(io.BytesIO(content))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages).strip()

    elif ext == ".docx":
        doc = docx.Document(io.BytesIO(content))
        return "\n".join(p.text for p in doc.paragraphs).strip()

    elif ext == ".txt":
        return content.decode("utf-8", errors="replace").strip()

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Upload a PDF, DOCX, or TXT file.",
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.post("/predict", response_model=PredictResponse, tags=["Prediction"])
async def predict(request: PredictRequest):
    """
    Classify resume text and return the predicted job category
    along with confidence scores for all categories.
    """
    return classify_text(request.text)


@app.post("/predict/upload", response_model=PredictResponse, tags=["Prediction"])
async def predict_upload(file: UploadFile = File(...)):
    """
    Upload a resume file (PDF, DOCX, or TXT) and return the predicted
    job category along with confidence scores.
    """
    # Validate extension
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: '{ext}'. Please upload a PDF, DOCX, or TXT file.",
        )

    # Read and extract text
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    text = extract_text_from_file(file.filename or "file.txt", content)

    if len(text.strip()) < 20:
        raise HTTPException(
            status_code=400,
            detail="Could not extract enough text from the file. Please ensure it contains readable resume content.",
        )

    result = classify_text(text)
    result.extracted_text = text[:500]  # Return preview of extracted text
    return result


# ---------------------------------------------------------------------------
# Run with:  python -m uvicorn main:app --reload --port 8000
# ---------------------------------------------------------------------------
