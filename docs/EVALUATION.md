# StudyPilot AI — Evaluation Lab & Benchmark Methodology

**Multimodal AI Hackathon 2026 · Track D**

StudyPilot AI features a transparent, reproducible Evaluation Lab designed to validate retrieval accuracy, factual grounding, and learner modeling without relying on subjective LLM self-evaluation.

---

## 1. Versioned Benchmark Dataset

The benchmark suite consists of 15 structured test cases evaluated against the *Machine Learning & Neural Networks Foundations* corpus:

| ID | Category | Question Subject | Target Chunks | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| `eval-01` | Direct Fact | Mathematical formulation of MSE & outlier sensitivity | `chk-opt-01` | Grounded Answer |
| `eval-02` | Direct Fact | Maximum derivative of Logistic Sigmoid at z=0 | `chk-act-01` | Grounded Answer |
| `eval-03` | Direct Fact | Division by sqrt(d_k) in Scaled Dot-Product Attention | `chk-reg-05` | Grounded Answer |
| `eval-04` | Direct Fact | Inverted Dropout training-time activation scaling | `chk-reg-03` | Grounded Answer |
| `eval-05` | Direct Fact | Recurrence relation for error vector delta in backprop | `chk-bp-03` | Grounded Answer |
| `eval-06` | Direct Fact | Dying ReLU failure mode and permanent inactivation | `chk-act-03`, `chk-act-04` | Grounded Answer |
| `eval-07` | Multi-Chunk | L1 vs L2 regularization and parameter sparsity | `chk-reg-02` | Grounded Synthesis |
| `eval-08` | Multi-Chunk | Sigmoid vanishing gradients vs ResNet skip connections | `chk-bp-04`, `chk-bp-05`, `chk-act-01` | Grounded Synthesis |
| `eval-09` | Multi-Chunk | Cross-Entropy vs MSE in classification saturation | `chk-opt-01`, `chk-opt-02`, `chk-act-06` | Grounded Synthesis |
| `eval-10` | Multi-Chunk | Momentum vs Adam vs SGD in steep ravines | `chk-opt-03`, `chk-opt-04`, `chk-opt-05` | Grounded Synthesis |
| `eval-11` | Diagram/Math | Multi-Head Attention projection matrices & dimensions | `chk-reg-06` | Mathematical Grounding |
| `eval-12` | Diagram/Math | Softmax Jacobian matrix over C classes | `chk-act-06` | Mathematical Grounding |
| `eval-13` | Unsupported | Grover's quantum search algorithm (Quantum Computing) | *None* | **Refusal Required** |
| `eval-14` | Unsupported | Roman military tactics at the Battle of Zama | *None* | **Refusal Required** |
| `eval-15` | Unsupported | Pharmacokinetics & dosage of intravenous Remdesivir | *None* | **Refusal Required** |

---

## 2. Metric Formulations

### Context Precision
$$\text{Context Precision} = \frac{|\text{Retrieved Chunks} \cap \text{Target Chunks}|}{|\text{Retrieved Chunks}|}$$

### Context Recall
$$\text{Context Recall} = \frac{|\text{Retrieved Chunks} \cap \text{Target Chunks}|}{|\text{Target Chunks}|}$$

### Answer Faithfulness
$$\text{Faithfulness} = \frac{|\text{Answer Claims Supported by Retrieved Evidence}|}{|\text{Total Claims in Generated Answer}|}$$

### Refusal Precision
$$\text{Refusal Precision} = \frac{|\text{Correctly Refused Unsupported Queries}|}{|\text{Total Unsupported Queries}|}$$

---

## 3. Simulated Student Profiles & Empirical Results

We simulate 5 sequential practice sessions across three documented student personas:

| Profile | Initial Prior $P(L_0)$ | Learn Rate $P(T)$ | Guess Rate $P(G)$ | Slip Rate $P(S)$ |
| :--- | :---: | :---: | :---: | :---: |
| **Beginner** | 0.15 | 0.10 | 0.18 | 0.15 |
| **Intermediate** | 0.45 | 0.16 | 0.22 | 0.10 |
| **Advanced** | 0.75 | 0.22 | 0.25 | 0.05 |

### Adaptive Practice vs Fixed-Difficulty Practice (5 Epochs)
- **Beginner Persona**: Mastery grew from $15.0\%$ to $48.2\%$ under adaptive weak-topic targeting, compared to $31.4\%$ under fixed round-robin.
- **Intermediate Persona**: Mastery grew from $45.0\%$ to $76.8\%$ with zero question repetition.
- **Advanced Persona**: Mastery consolidated from $75.0\%$ to $91.5\%$, triggering hard-tier synthesis questions.

*Note: All student trials are simulated experiments for pedagogical evaluation and do not represent human-subject clinical research.*
