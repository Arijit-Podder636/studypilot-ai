# StudyPilot AI — System Architecture & Design Specification

## 1. High-Level System Architecture

StudyPilot AI is engineered as a full-stack, local-first educational SaaS platform optimized for Google AI Studio and hermetic evaluation environments.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        STUDYPILOT AI FRONTEND                          │
│                                                                        │
│  ┌─────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │     Navigation Bar      │  │        Active Viewport              │  │
│  │ ─────────────────────── │  │ ─────────────────────────────────── │  │
│  │ • 1. Dashboard          │  │ [Dashboard]      [Library]          │  │
│  │ • 2. Study Library      │  │ [AI Tutor]       [Quiz & Exams]     │  │
│  │ • 3. AI Tutor           │  │ [Analytics]      [Revision Planner] │  │
│  │ • 4. Quiz & Mock Exams  │  │ [Knowledge Map]  [Evaluation Lab]   │  │
│  │ • 5. Learning Analytics │  │ [Settings & Data Management]        │  │
│  │ • 6. Revision Planner   │  └─────────────────────────────────────┘  │
│  │ • 7. Knowledge Map      │                      ▲                    │
│  │ • 8. Evaluation Lab     │                      │                    │
│  │ • 9. Settings           │                      ▼                    │
│  └─────────────────────────┘  ┌─────────────────────────────────────┐  │
│                               │       Client State & Cache          │  │
│                               │  IndexedDB (Courses, Chunks, BKT,   │  │
│                               │  Quizzes, History, Evaluation Runs) │  │
│                               └─────────────────────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / JSON API (/api/*)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   SERVER-SIDE GATEWAY (Node.js/Vite)                   │
│                                                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │  /api/rag/query  │  │ /api/tutor/chat  │  │ /api/quiz/generate   │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────┘  │
│           │                     │                       │              │
│  ┌────────┴─────────┐  ┌────────┴─────────┐  ┌──────────┴───────────┐  │
│  │ /api/eval/run    │  │ /api/documents   │  │ /api/health          │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────┘  │
│           ▼                     ▼                       ▼              │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              RAG Engine & Grounding Validator                    │  │
│  │     • Chunk Extraction  • Tokenizer/BM25  • Citation Verifier    │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
│                                 ▼                                      │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │      @google/genai SDK (model name configured in code, User-Agent Header)     │  │
│  │              process.env.GEMINI_API_KEY (Server-Only)            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Retrieval Pipeline & Grounding

### Ingestion & Chunking
1. **Raw Document Normalization**: Text extracted from PDF, PPTX, Markdown, or transcripts is normalized into paragraphs.
2. **Structural Chunking**: Contiguous logical units (~300–500 tokens) are segmented with 20% paragraph overlap to prevent edge truncation.
3. **Metadata Enrichment**: Each chunk is assigned:
   - Stable chunk ID (`chk-<doc>-<index>`)
   - Document title, page number, slide number, or video timestamp
   - Topic and subtopic classification
   - Mathematical formulas and top keyword tokens

### Retrieval Algorithm
- **BM25 Inverted Index**: Terms are filtered against English stop words and indexed. The score function evaluates term frequency $TF(t, d)$ and inverse document frequency $IDF(t)$:
  $$Score(D, Q) = \sum_{t \in Q} IDF(t) \cdot \frac{TF(t, D) \cdot (k_1 + 1)}{TF(t, D) + k_1 \cdot (1 - b + b \cdot \frac{|D|}{\text{avgdl}})}$$
  with calibrated hyperparameters $k_1 = 1.2$ and $b = 0.75$.
- **Relevance Gate & Refusal**: A question is treated as **unsupported** unless the top chunk reaches a BM25 score of at least $0.80$ **and** matches at least two of the question's content terms. Unsupported questions get a structured insufficient-evidence reply with no citation, rather than letting the model speculate.

### Answers and Citations (what is and is not measured)
- **Local (no-AI) answers are quotes.** The deterministic engine never writes answer text. It returns the best-matching sentence(s) copied verbatim from the retrieved chunk (or the text after an `Answer:` line in the source). A heading-only chunk is never accepted as evidence.
- **AI answers are re-checked, not trusted.** `src/server/tutorResponseBuilder.ts` ignores any model-reported confidence; keeps only citations to chunks that were actually retrieved; shows a model-supplied quote only if it really appears in the chunk (otherwise the best-matching sentences are copied from the chunk); and checks every answer sentence against the cited text. Sentences whose terms (words, numbers, command flags) are not found are listed as *not confirmed*; if no sentence matches, the reply becomes a refusal. The browser repeats the citation check before display.
- **Two measured numbers, both plain ratios (0–1):** *retrieval relevance* = share of the question's terms found in the cited chunk; *lexical overlap* = share of the answer's terms found in the displayed excerpt (AI answers only). Neither is a confidence or a probability, and neither proves that a statement is correct. A claim that reuses the source's words but reverses its meaning is a known blind spot.
- **Not scored:** library previews and quiz source references are shown without any support score because no claim is being checked.

---

## 3. Learner Model Design (Bayesian Knowledge Tracing)

The application tracks separate latent knowledge parameters for each course topic using a 4-parameter BKT model:

- $P(L_0) = 0.20$: Prior probability student already knows the topic.
- $P(T) = 0.15$: Probability student transitions to mastery at practice opportunity $t$.
- $P(G) = 0.20$: Probability of guessing correctly without knowing the concept.
- $P(S) = 0.10$: Probability of slipping (answering incorrectly despite knowing).

### Update Equations
Upon receiving a student response:
1. **Observation Update**:
   - If Correct:
     $$P(L_t \mid \text{Correct}) = \frac{P(L_t)(1 - P(S))}{P(L_t)(1 - P(S)) + (1 - P(L_t))P(G)}$$
   - If Incorrect:
     $$P(L_t \mid \text{Incorrect}) = \frac{P(L_t)P(S)}{P(L_t)P(S) + (1 - P(L_t))(1 - P(G))}$$
2. **Transit Update**:
   $$P(L_{t+1}) = P(L_t \mid \text{obs}) + (1 - P(L_t \mid \text{obs})) \cdot P(T)$$

### Spaced Repetition Stability
Retention stability in days scales with mastery and recent accuracy:
$$\text{Stability} = \begin{cases} 1 \text{ day} & \text{if } P(L) < 0.40 \\ \max(2, 3 \times \text{acc}) & \text{if } 0.40 \le P(L) < 0.65 \\ \max(5, 7 \times \text{acc}) & \text{if } 0.65 \le P(L) < 0.85 \\ \max(14, 30 \times \text{acc}) & \text{if } P(L) \ge 0.85 \end{cases}$$

---

## 4. Persistence Architecture

Data is stored in IndexedDB under database `studypilot_ai_db` with seven object stores:
- `courses`
- `documents`
- `mastery`
- `quizzes`
- `tutor`
- `revision`
- `evaluations`

If IndexedDB is restricted or in an isolated sandboxed iframe, the service transparently fails over to `localStorage` with identical JSON schemas.
