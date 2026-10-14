import { Chunk, QuestionDifficulty, QuizItem, QuizSubmissionItem } from '../types';

export const VERIFIED_QUESTION_BANK: QuizItem[] = [
  // Module 1: Optimization & Loss Functions
  {
    id: 'q-opt-01',
    prompt: 'Given true target y = 4.0 and prediction y_hat = 1.0 for a single sample (N=1), what is the exact Mean Squared Error (MSE)?',
    type: 'numerical',
    correctAnswer: 9.0,
    tolerance: 0.05,
    explanation: 'L_MSE = (1/N) * (y - y_hat)^2 = (4.0 - 1.0)^2 = 3^2 = 9.0.',
    topicId: 'opt-loss',
    subtopic: 'Mean Squared Error (MSE)',
    difficulty: 'easy',
    chunkIds: ['chk-opt-01'],
    sourceCitations: [{
      chunkId: 'chk-opt-01',
      documentTitle: 'Lecture 03: Optimization Landscapes and Objective Functions.pdf',
      pageOrSlide: 4,
      excerpt: 'L_MSE = (1 / N) * SUM_{i=1}^N (y_i - y_hat_i)^2',
    }]
  },
  {
    id: 'q-opt-02',
    prompt: 'Why is Cross-Entropy Loss preferred over Mean Squared Error when training neural networks with softmax outputs for classification?',
    type: 'multiple-choice',
    options: [
      'MSE creates quadratic computational complexity during matrix multiplication',
      'Confidently incorrect predictions produce steep gradients with Cross-Entropy, avoiding gradient starvation',
      'Cross-Entropy guarantees that the overall loss landscape is strictly convex for multi-layer networks',
      'MSE cannot be evaluated for non-integer target labels'
    ],
    correctAnswer: 'Confidently incorrect predictions produce steep gradients with Cross-Entropy, avoiding gradient starvation',
    explanation: 'Cross-Entropy cancels out the sigmoid/softmax derivative, yielding linear error signal (p_i - y_i). With MSE, saturation causes near-zero gradients when mistakes are confident.',
    topicId: 'opt-loss',
    subtopic: 'Cross-Entropy Loss',
    difficulty: 'medium',
    chunkIds: ['chk-opt-02', 'chk-act-06'],
    sourceCitations: [{
      chunkId: 'chk-opt-02',
      documentTitle: 'Lecture 03: Optimization Landscapes and Objective Functions.pdf',
      pageOrSlide: 9,
      excerpt: 'Unlike MSE applied to probabilistic classification, Cross-Entropy provides steep gradients when predictions are confidently wrong, preventing gradient starvation in saturated neurons.',
    }]
  },
  {
    id: 'q-opt-03',
    prompt: 'In classical SGD with Momentum, if the friction parameter gamma = 0.9, by approximately what factor does velocity scale persistent descent steps asymptotically?',
    type: 'numerical',
    correctAnswer: 10,
    tolerance: 0.5,
    explanation: 'The effective step multiplier of exponential moving average velocity is 1 / (1 - gamma) = 1 / (1 - 0.9) = 10.',
    topicId: 'opt-loss',
    subtopic: 'Learning Rate & Momentum',
    difficulty: 'hard',
    chunkIds: ['chk-opt-04'],
    sourceCitations: [{
      chunkId: 'chk-opt-04',
      documentTitle: 'Lecture 03: Optimization Landscapes and Objective Functions.pdf',
      pageOrSlide: 18,
      excerpt: 'Typical velocity accumulates past gradients as an exponentially decaying moving average with effective step multiplier 1 / (1 - gamma).',
    }]
  },

  // Module 2: Neural Architectures & Backpropagation
  {
    id: 'q-bp-01',
    prompt: 'During reverse-mode automatic differentiation in a multilayer network, what is the mathematical expression for the parameter gradient dL / dW^[l]?',
    type: 'multiple-choice',
    options: [
      'delta^[l] * (a^[l-1])^T',
      '(W^[l])^T * delta^[l]',
      'sigma_prime(z^[l]) * a^[l-1]',
      'delta^[l] odot z^[l]'
    ],
    correctAnswer: 'delta^[l] * (a^[l-1])^T',
    explanation: 'The gradient of the scalar loss with respect to weight matrix W^[l] is the outer product between the layer error vector delta^[l] and the transposed input activation (a^[l-1])^T.',
    topicId: 'nn-backprop',
    subtopic: 'Weight Gradient Derivation',
    difficulty: 'medium',
    chunkIds: ['chk-bp-03'],
    sourceCitations: [{
      chunkId: 'chk-bp-03',
      documentTitle: 'Lecture 05: Feedforward Networks and Reverse-Mode Differentiation.pptx',
      pageOrSlide: 12,
      excerpt: 'dL / dW^[l] = delta^[l] * (a^[l-1])^T',
    }]
  },
  {
    id: 'q-bp-02',
    prompt: 'What mathematical property causes deep networks with Sigmoid activations to suffer from vanishing gradients?',
    type: 'short-answer',
    correctAnswer: 'The maximum derivative of Sigmoid is 0.25 (less than 1), causing compounding exponential decay across layers.',
    gradingRubric: 'Must state that sigmoid derivative is bounded by 0.25 (or <= 0.25) and causes exponential decay across multiple layers.',
    explanation: 'Because |sigma_prime(z)| <= 0.25, multiplying derivatives across L hidden layers leads to an upper bound of (0.25)^L, which decays to near zero exponentially.',
    topicId: 'nn-backprop',
    subtopic: 'Vanishing & Exploding Gradients',
    difficulty: 'hard',
    chunkIds: ['chk-bp-04', 'chk-act-01'],
    sourceCitations: [{
      chunkId: 'chk-bp-04',
      documentTitle: 'Lecture 05: Feedforward Networks and Reverse-Mode Differentiation.pptx',
      pageOrSlide: 16,
      excerpt: 'If the maximum singular value of weight matrices ||W^[j]|| < 1 and activation derivatives |sigma_prime| <= 0.25 (as in Sigmoid), gradients decay exponentially with depth (O(gamma^k), gamma < 1).',
    }]
  },

  // Module 3: Activation Functions & Non-Linearity
  {
    id: 'q-act-01',
    prompt: 'What is the derivative of the standard Hyperbolic Tangent (Tanh) activation function in terms of its output tanh(z)?',
    type: 'multiple-choice',
    options: [
      '1 - tanh^2(z)',
      'tanh(z) * (1 - tanh(z))',
      '1 + tanh^2(z)',
      'cosh(z) / sinh(z)'
    ],
    correctAnswer: '1 - tanh^2(z)',
    explanation: 'd/dz [tanh(z)] = 1 - tanh^2(z). At z=0, tanh(0)=0 so the derivative equals 1.0.',
    topicId: 'activations',
    subtopic: 'Sigmoid & Tanh Saturation',
    difficulty: 'easy',
    chunkIds: ['chk-act-02'],
    sourceCitations: [{
      chunkId: 'chk-act-02',
      documentTitle: 'Textbook Chapter 06: Non-Linear Activation Dynamics.md',
      pageOrSlide: 5,
      excerpt: 'Its derivative is: tanh_prime(z) = 1 - tanh^2(z)',
    }]
  },
  {
    id: 'q-act-02',
    prompt: 'How does Leaky ReLU modify the standard ReLU activation for negative inputs (z < 0)?',
    type: 'multiple-choice',
    options: [
      'Sets negative outputs to exactly 0 to maximize sparsity',
      'Introduces a small positive slope alpha (e.g. 0.01) to allow non-zero gradients',
      'Applies a soft exponential curve that saturates at -1',
      'Clips negative values to a threshold of -c'
    ],
    correctAnswer: 'Introduces a small positive slope alpha (e.g. 0.01) to allow non-zero gradients',
    explanation: 'Leaky ReLU uses f(z) = alpha * z for z < 0 with slope alpha > 0, ensuring that a small gradient always flows backward to prevent the Dying ReLU problem.',
    topicId: 'activations',
    subtopic: 'Leaky ReLU & Parametric Variants',
    difficulty: 'medium',
    chunkIds: ['chk-act-05'],
    sourceCitations: [{
      chunkId: 'chk-act-05',
      documentTitle: 'Textbook Chapter 06: Non-Linear Activation Dynamics.md',
      pageOrSlide: 14,
      excerpt: 'Leaky ReLU addresses the dying neuron failure mode by introducing a small non-zero slope alpha (commonly alpha = 0.01) for negative inputs',
    }]
  },

  // Module 4: Regularization & Transformer Attention
  {
    id: 'q-reg-01',
    prompt: 'Why does L1 regularization (Lasso) induce parameter sparsity while L2 regularization (Ridge) does not?',
    type: 'multiple-choice',
    options: [
      'L1 subtracts a constant rate proportional to sgn(w), driving weights directly to zero',
      'L2 divides weights by the variance of the input batch',
      'L1 zeroes out neurons dynamically using a Bernoulli distribution',
      'L2 has non-differentiable points at the origin'
    ],
    correctAnswer: 'L1 subtracts a constant rate proportional to sgn(w), driving weights directly to zero',
    explanation: 'L1 penalty is linear in |w|, so its gradient is sgn(w). This subtracts a fixed quantity at each step until weights reach exactly zero. L2 shrinks multiplicatively by (1 - eta*lambda), scaling down large weights but leaving small non-zero values.',
    topicId: 'reg-attention',
    subtopic: 'L1 vs L2 Weight Decay',
    difficulty: 'medium',
    chunkIds: ['chk-reg-02'],
    sourceCitations: [{
      chunkId: 'chk-reg-02',
      documentTitle: 'Transcript: Lecture 09 - Generalization, Regularization and Transformers.txt',
      timestamp: '08:10 - 14:25',
      excerpt: 'L1 subtracts a constant rate, driving parameters exactly to zero and producing sparse weight matrices.',
    }]
  },
  {
    id: 'q-reg-02',
    prompt: 'In Scaled Dot-Product Attention, what is the role of the scaling factor 1 / sqrt(d_k)?',
    type: 'multiple-choice',
    options: [
      'It normalizes the key matrix so that its singular values sum to 1',
      'It prevents dot product variance from growing linearly with d_k, avoiding softmax saturation and vanishing gradients',
      'It projects key and query vectors into orthogonal latent subspaces',
      'It ensures causal masking for autoregressive language decoding'
    ],
    correctAnswer: 'It prevents dot product variance from growing linearly with d_k, avoiding softmax saturation and vanishing gradients',
    explanation: 'For independent zero-mean unit-variance components, the dot product variance equals d_k. For large d_k, large magnitudes saturate the softmax and cause vanishing gradients. Dividing by sqrt(d_k) restores variance to 1.',
    topicId: 'reg-attention',
    subtopic: 'Scaled Dot-Product Attention',
    difficulty: 'hard',
    chunkIds: ['chk-reg-05'],
    sourceCitations: [{
      chunkId: 'chk-reg-05',
      documentTitle: 'Transcript: Lecture 09 - Generalization, Regularization and Transformers.txt',
      timestamp: '27:10 - 34:15',
      excerpt: 'For large d_k (e.g., 64 or 128), dot products grow large in magnitude, pushing softmax into saturated regimes with vanishingly small gradients. Scaling by 1 / sqrt(d_k) restores variance to unity.',
    }]
  }
];

export class QuizEngine {
  /**
   * Generates a quiz tailored to requested topic, difficulty, or adaptive needs.
   */
  public static generateQuiz(
    courseId: string,
    topicId?: string,
    targetDifficulty: QuestionDifficulty | 'adaptive' = 'adaptive',
    questionCount: number = 5,
    userTopicMastery?: Record<string, number>
  ): QuizItem[] {
    let pool = [...VERIFIED_QUESTION_BANK];

    if (topicId && topicId !== 'all') {
      pool = pool.filter(q => q.topicId === topicId);
    }

    if (targetDifficulty !== 'adaptive') {
      pool = pool.filter(q => q.difficulty === targetDifficulty);
    } else if (userTopicMastery) {
      // Prioritize questions from topics where user mastery is lowest
      pool.sort((a, b) => {
        const masteryA = userTopicMastery[a.topicId] ?? 0.5;
        const masteryB = userTopicMastery[b.topicId] ?? 0.5;
        return masteryA - masteryB;
      });
    }

    // Fallback if filtered pool is smaller than questionCount
    if (pool.length < questionCount) {
      pool = [...VERIFIED_QUESTION_BANK];
    }

    // Shuffle and pick top questionCount
    const shuffled = pool.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, questionCount);
  }

  /**
   * Deterministically evaluates an objective or numerical student response.
   */
  public static evaluateAnswer(
    question: QuizItem,
    studentAnswer: string | number
  ): QuizSubmissionItem {
    let isCorrect = false;
    let score = 0;
    let feedback = '';

    if (question.type === 'multiple-choice') {
      const target = String(question.correctAnswer).trim().toLowerCase();
      const student = String(studentAnswer).trim().toLowerCase();
      isCorrect = target === student;
      score = isCorrect ? 1.0 : 0.0;
      feedback = isCorrect
        ? 'Correct! ' + question.explanation
        : `Incorrect. The correct answer is: "${question.correctAnswer}". ${question.explanation}`;
    } else if (question.type === 'numerical') {
      const numTarget = Number(question.correctAnswer);
      const numStudent = Number(studentAnswer);
      const tolerance = question.tolerance ?? 0.01;

      if (!isNaN(numStudent)) {
        isCorrect = Math.abs(numTarget - numStudent) <= tolerance;
        score = isCorrect ? 1.0 : 0.0;
        feedback = isCorrect
          ? `Correct! Answer within tolerance ±${tolerance}. ${question.explanation}`
          : `Incorrect. Expected ${numTarget} (±${tolerance}), got ${numStudent}. ${question.explanation}`;
      } else {
        isCorrect = false;
        score = 0;
        feedback = `Invalid numeric input: "${studentAnswer}".`;
      }
    } else {
      // Short answer heuristic / rubric check
      const studentStr = String(studentAnswer).toLowerCase();
      const rubricKeywords = question.explanation.toLowerCase().split(/\s+/).filter(w => w.length > 5);
      const matches = rubricKeywords.filter(k => studentStr.includes(k));
      const matchRatio = rubricKeywords.length > 0 ? matches.length / rubricKeywords.length : 0;

      isCorrect = matchRatio >= 0.4 || studentStr.includes(String(question.correctAnswer).toLowerCase());
      score = isCorrect ? (matchRatio > 0.7 ? 1.0 : 0.75) : 0.2;
      feedback = isCorrect
        ? `Accurate conceptual reasoning. ${question.explanation}`
        : `Partial or missing core principles. Reference answer: ${question.correctAnswer}. ${question.explanation}`;
    }

    return {
      questionId: question.id,
      studentAnswer,
      isCorrect,
      score,
      feedback,
      sourceCitations: question.sourceCitations
    };
  }
}
