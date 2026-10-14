# StudyPilot AI — Personalized Tutoring & Adaptive Learning

**Multimodal AI Hackathon 2026 · Track D**

StudyPilot AI unifies lecture slides, textbook PDFs, markdown notes, and video transcripts into a strictly grounded, source-cited knowledge base. Unlike generic AI chatbots that produce ungrounded hallucinations, StudyPilot AI guarantees that every educational claim is anchored to verifiable course excerpts, updates an explainable Bayesian Knowledge Tracing (BKT) learner model, generates adaptive assessments, and provides a full empirical Evaluation Lab.

---

## 🌟 Key Capabilities

1. **Source-Grounded Socratic AI Tutor**:
   - Synthesizes answers strictly using retrieved course chunks.
   - Clickable citations link directly to source page numbers, slide numbers, or video timestamps.
   - Detects unsupported and out-of-domain queries with transparent refusals instead of hallucinated answers.
   - Configurable depth: *Beginner* (intuitive analogies), *Intermediate* (balanced definitions), and *Advanced* (formal mathematical proofs).

2. **Multimodal Course Library & Chunking**:
   - Ingests PDFs, slide decks (PPT/PPTX), markdown notes, text files, and video transcripts.
   - Preserves structural boundaries, LaTeX mathematical formulas, and section identifiers.
   - Real-time search and chunk inspection across all course materials.

3. **Adaptive Quiz & Mock Exam Engine**:
   - Generates multiple-choice, numerical (with tolerance checking), and short-answer questions.
   - Objective deterministic grading and evidence-based rubric validation.
   - Timed countdown exam mode and mistake review with cited explanation keys.

4. **Explainable Learner Modeling (Bayesian Knowledge Tracing)**:
   - Tracks mastery for each topic using a 4-parameter BKT hidden Markov model ($P(L_0)=0.20, P(T)=0.15, P(G)=0.20, P(S)=0.10$).
   - Spaced repetition scheduling based on Ebbinghaus forgetting curve stability.
   - Topic-level weak area identification and targeted intervention suggestions.

5. **Evaluation Lab & Simulated Trials (Track D Essential)**:
   - Automated benchmark suite over a versioned 15-case dataset.
   - Evaluates Context Precision, Context Recall, Faithfulness, Answer Relevancy, and Refusal Accuracy.
   - Multi-epoch simulated student experimenter (*Beginner*, *Intermediate*, *Advanced*) comparing Adaptive Practice against Fixed-Difficulty baselines.

6. **Local-First Reliability & Persistence**:
   - Persistent storage in IndexedDB with full offline fallback.
   - Complete JSON state export, import, and diagnostic reset controls.
   - Pre-loaded with a comprehensive *Machine Learning & Neural Networks Foundations* sample course.

---

## 🏗️ Architecture Overview

- **Frontend**: React 19, TypeScript, Tailwind CSS, Recharts for analytics, Lucide icons.
- **Backend & AI Gateway**: Node.js Express server integrated with Vite middleware, invoking the official `@google/genai` TypeScript SDK (`gemini-3.8-flash`) via `process.env.GEMINI_API_KEY`.
- **RAG Engine**: BM25 tokenized term-frequency retrieval combined with high-dimensional vector embeddings, paired with a relevance threshold refusal guard.
- **Learner Engine**: Mathematical 4-parameter Bayesian Knowledge Tracing engine.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- An optional `GEMINI_API_KEY` set in your environment (the application seamlessly provides a transparent local deterministic fallback if unconfigured).

### Installation & Execution
```bash
# Install dependencies
npm install

# Start the full-stack development server
npm run dev
```

Visit `http://localhost:3000` to interact with StudyPilot AI.

---

## 🧪 Testing & Verification

StudyPilot AI includes a built-in interactive benchmark runner in the **Evaluation Lab** view. Click **"Run Test Suite"** to execute all 15 versioned test cases and inspect empirical metrics in real time.

---

## 📖 Documentation Index

- [System Architecture](docs/ARCHITECTURE.md)
- [Evaluation Lab & Methodology](docs/EVALUATION.md)
- [User Guide](docs/USER_GUIDE.md)
- [Hackathon Demo Script (3–10 min)](docs/DEMO_SCRIPT.md)
