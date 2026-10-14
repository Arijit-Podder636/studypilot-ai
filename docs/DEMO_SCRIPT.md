# StudyPilot AI — Hackathon Demonstration Script (3–10 Minutes)

**Multimodal AI Hackathon 2026 · Track D**

Follow this structured demonstration workflow to present StudyPilot AI to hackathon judges.

---

### Step 1: Introduction & Dashboard (1 Minute)
- **Action**: Open the application at `http://localhost:3000`. The Dashboard loads the pre-configured *Machine Learning & Neural Networks Foundations* course.
- **Talking Point**: "Most AI study tools act like generic chatbots that hallucinate without accountability. StudyPilot AI solves this by coupling strict source grounding with an explainable Bayesian Knowledge Tracing learner model and an empirical Evaluation Lab."
- **Visuals**: Point out the Overall Mastery percentage, the Ingested Documents count, and the Priority Weak Areas alert.

---

### Step 2: Multimodal Study Library & Chunks (1 Minute)
- **Action**: Click on **Study Library** in the sidebar.
- **Talking Point**: "Our library ingests PDFs, slide decks, markdown, and video transcripts. Content is broken into overlapping structural chunks with preserved page numbers and timestamps."
- **Visuals**: Filter by search (e.g. typing `softmax` or `attention`) and click **"Inspect"** on a chunk card to reveal the verbatim text and extracted formulas.

---

### Step 3: Source-Grounded Socratic AI Tutor (2 Minutes)
- **Action**: Navigate to **AI Tutor**.
- **Demonstration A (Source-Matched Answer)**: Click the prompt starter: *"Why does dividing by sqrt(d_k) prevent vanishing gradients in Self-Attention?"*
- **Talking Point**: "The tutor retrieves the exact lecture excerpt, sets explanation depth (Beginner, Intermediate, or Advanced), and provides clickable citations."
- **Action**: Click the cited document badge. The sliding **Citation Drawer** opens, showing Lecture 09, Timestamp 27:10–34:15, with the exact mathematical excerpt.
- **Demonstration B (Honest Refusal)**: Enter an out-of-domain query: *"What were the military tactics of Scipio Africanus at the Battle of Zama?"*
- **Talking Point**: "Notice what happens: StudyPilot refuses to hallucinate external knowledge. It transparently notifies the student that Roman history is absent from the course material and recommends sticking to the syllabus."

---

### Step 4: Adaptive Quiz & Bayesian Mastery Calibration (2 Minutes)
- **Action**: Click **"Launch Quiz"** in the top navigation bar or go to **Quiz & Mock Exams**.
- **Demonstration**: Select *Comprehensive Adaptive*, difficulty *Adaptive*, 3 Questions. Click **"Generate & Begin Assessment"**.
- **Action**: Complete the 3 questions (Multiple Choice and Numerical with tolerance checks). Click **"Submit Assessment"**.
- **Talking Point**: "Grading is deterministic and grounded. As soon as we submit, the Bayesian Knowledge Tracing engine calculates the exact posterior update and adjusts topic mastery."
- **Visuals**: Show the **Bayesian Knowledge Tracing Updates Applied** card with $+7.2\%$ mastery deltas.

---

### Step 5: Learning Analytics & Revision Planner (1 Minute)
- **Action**: Click **Learning Analytics**.
- **Visuals**: Show the Recharts Topic Mastery bar chart and score progression line chart.
- **Talking Point**: "All metrics derive from genuine student attempts in IndexedDB—no fake telemetry. We also expose the 4-parameter BKT formulas ($P(L_0), P(T), P(G), P(S)$) for full algorithmic transparency."
- **Action**: Quickly click **Revision Planner** and flip a flashcard to show spaced repetition intervals.

---

### Step 6: Evaluation Lab & Synthetic Trials (2 Minutes)
- **Action**: Navigate to **Evaluation Lab**.
- **Demonstration A (RAG Benchmarks)**: Click **"Run Test Suite"**.
- **Talking Point**: "Crucial for Track D: We provide a 15-case versioned benchmark suite testing direct fact recall, multi-chunk synthesis, and out-of-domain refusals. Notice our 100% Refusal Accuracy and >85% Faithfulness."
- **Demonstration B (Simulated Student Trials)**: Toggle the **Simulated Students** tab. Select *Beginner* persona, *Adaptive Practice*, and click **"Simulate 5 Practice Epochs"**.
- **Talking Point**: "We simulate multiple learning epochs comparing adaptive weak-topic targeting against fixed baselines, showing a measured $+33.2\%$ mastery gain."

---

### Conclusion & Wrap-Up
- **Summary**: "StudyPilot AI delivers verifiable, source-grounded learning with real Bayesian personalization and transparent evaluation benchmarks for Multimodal AI Hackathon 2026 Track D."
