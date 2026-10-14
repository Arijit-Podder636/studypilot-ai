# StudyPilot AI — Comprehensive User Guide

Welcome to **StudyPilot AI**, your personalized, source-grounded tutoring and adaptive learning assistant.

---

## 1. Navigating the Workspace

StudyPilot AI features 9 dedicated learning and diagnostic views:
1. **Dashboard**: High-level mastery progress, weak topic alerts, and recommended study actions.
2. **Study Library**: Document ingestion, text/transcript parsing, and searchable knowledge chunk explorer.
3. **AI Tutor**: Socratic conversational interface with interactive citations and explanation depth control.
4. **Quiz & Mock Exams**: Adaptive test generator, timed exam runner, and question-by-question review with source links.
5. **Learning Analytics**: Recharts visualizations of topic mastery vs target, score progression, and BKT formulas.
6. **Revision Planner**: Spaced repetition calendar, exam target planner, and interactive flashcards.
7. **Course Knowledge Map**: Dependency graph displaying prerequisite relationships and supporting course notes.
8. **Evaluation Lab**: Automated 15-case benchmark suite and simulated student learning experiments.
9. **Settings & Data**: JSON state export/import, server API status, and diagnostic sample reset.

---

## 2. Ingesting Course Materials

1. Go to the **Study Library** tab.
2. Click **"Upload File (PDF/PPT/MD/TXT)"** or **"Paste Transcript"**.
3. StudyPilot AI automatically parses headings, splits content into structural chunks with 20% overlap, preserves page and slide numbers, and indexes keywords and mathematical formulas.
4. Click **"Inspect"** on any chunk card to view the exact text, formulas, and metadata tags.

---

## 3. Conversing with the Socratic AI Tutor

1. Select **AI Tutor** from the navigation bar.
2. Choose your preferred explanation depth:
   - **Beginner**: Focuses on intuitive analogies and step-by-step clarity.
   - **Intermediate**: Balances definitions and architectural trade-offs.
   - **Advanced**: Rigorous mathematical derivations, tensor dimensions, and asymptotic complexity.
3. Enter your query or pick one of the sample prompt starters.
4. The response will include:
   - An answer taken from your documents. Without the AI service it is a direct quote from the best-matching passage; with it, the answer is checked against the cited text and any statement the text does not cover is flagged as *not confirmed*.
   - **Source Citations**: Click any citation badge to open the sliding drawer displaying the exact source excerpt and page/slide/timestamp, plus what was measured (retrieval relevance and, for AI answers, lexical overlap). These are word-matching ratios, not confidence levels, and a high number does not prove the answer is correct.
   - **Suggested Follow-Up Inquiries**: Click to explore deeper conceptual nuances.
   - **Refusal Banner**: If you ask an unsupported question (e.g., Roman history in a Machine Learning course), the tutor will transparently refuse rather than hallucinating external claims.

---

## 4. Taking Adaptive Quizzes

1. Go to **Quiz & Mock Exams** or click **"Launch Quiz"** in the top navigation bar.
2. Select your topic scope (or choose *Comprehensive Adaptive*).
3. Set your difficulty (*Adaptive*, *Easy*, *Medium*, *Hard*), number of questions (3, 5, 8), and toggle *Timed Mode*.
4. Answer the questions. Multiple choice uses button selection; numerical questions check values against configured tolerances; short answer evaluates conceptual reasoning.
5. Submit the assessment to review score percentages, detailed explanations, and source chunk links. Your Bayesian learner model will update immediately.

---

## 5. Reviewing Knowledge & Spaced Repetition

1. Review your weak topics in the **Dashboard** and **Learning Analytics** views.
2. Open **Revision Planner** and click **"Generate Schedule"** to calculate review due dates based on retention decay.
3. Use the **Grounded Flashcards** card deck on the right to test rapid active recall on critical definitions and formulas. Click the card to flip between prompt and answer.
