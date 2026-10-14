import { Course, DocumentSource, EvaluationTestCase } from '../types';

export const SAMPLE_COURSE: Course = {
  id: 'course-ml-101',
  title: 'Machine Learning & Neural Networks Foundations',
  code: 'CS-482',
  description: 'Rigorous mathematical foundations of deep learning: gradient optimization, backpropagation mechanics, activation dynamics, regularization, and self-attention architectures.',
  category: 'Artificial Intelligence & Machine Learning',
  totalDocuments: 4,
  totalChunks: 24,
  createdAt: '2026-09-01T00:00:00.000Z',
  isSampleCourse: true,
  topics: [
    {
      id: 'opt-loss',
      title: 'Optimization & Loss Functions',
      description: 'Convex vs non-convex loss surfaces, Mean Squared Error, Binary and Categorical Cross-Entropy, Gradient Descent variants, and momentum acceleration.',
      prerequisites: ['Multivariate Calculus', 'Linear Algebra'],
      subtopics: ['Mean Squared Error (MSE)', 'Cross-Entropy Loss', 'Stochastic Gradient Descent', 'Learning Rate & Momentum']
    },
    {
      id: 'nn-backprop',
      title: 'Neural Architectures & Backpropagation',
      description: 'Multilayer perceptrons, forward computation graphs, reverse-mode automatic differentiation, the multivariate chain rule, and vanishing gradient dynamics.',
      prerequisites: ['Optimization & Loss Functions'],
      subtopics: ['Feedforward Computation', 'The Chain Rule of Calculus', 'Weight Gradient Derivation', 'Vanishing & Exploding Gradients']
    },
    {
      id: 'activations',
      title: 'Activation Functions & Non-Linearity',
      description: 'Representational capacity of non-linear mappings, Sigmoid and Tanh saturation profiles, Dying ReLU phenomena, Leaky ReLU, and Softmax categorical distributions.',
      prerequisites: ['Neural Architectures & Backpropagation'],
      subtopics: ['Sigmoid & Tanh Saturation', 'Rectified Linear Unit (ReLU)', 'Leaky ReLU & Parametric Variants', 'Softmax Probability Vectors']
    },
    {
      id: 'reg-attention',
      title: 'Regularization & Transformer Self-Attention',
      description: 'Generalization bounds, L1 Lasso and L2 Ridge weight decay, Dropout Bernoulli masks, Early Stopping heuristics, and Scaled Dot-Product Self-Attention mechanisms.',
      prerequisites: ['Activation Functions & Non-Linearity'],
      subtopics: ['L1 vs L2 Weight Decay', 'Dropout Regularization', 'Overfitting Diagnostics', 'Scaled Dot-Product Attention']
    }
  ]
};

export const CS302_LINUX_COURSE: Course = {
  id: 'course-linux-302',
  title: 'Linux Systems Administration & Shell Operations',
  code: 'CS-302',
  description: 'Operating systems fundamentals, Linux shell commands, file systems, permissions, process management, and diagnostic utilities.',
  category: 'Systems & Operating Systems',
  totalDocuments: 1,
  totalChunks: 4,
  createdAt: '2026-09-15T00:00:00.000Z',
  isSampleCourse: true,
  topics: [
    {
      id: 'linux-cli',
      title: 'Linux CLI & File Management',
      description: 'Directory inspection, listing hidden files, text filtering with head and tail, and file movement vs duplication.',
      prerequisites: ['Basic Computing'],
      subtopics: ['Hidden Files (ls -la)', 'Viewing Ends of Files (head/tail)', 'Copy vs Move (cp/mv)']
    }
  ]
};

export const SAMPLE_DOCUMENTS: DocumentSource[] = [
  {
    id: 'doc-opt-loss',
    courseId: 'course-ml-101',
    title: 'Lecture 03: Optimization Landscapes and Objective Functions.pdf',
    type: 'pdf',
    topic: 'Optimization & Loss Functions',
    subtopics: ['Mean Squared Error (MSE)', 'Cross-Entropy Loss', 'Stochastic Gradient Descent', 'Learning Rate & Momentum'],
    totalChunks: 6,
    uploadedAt: '2026-09-10T14:30:00.000Z',
    fileSizeBytes: 2457600,
    summary: 'Detailed derivation of Mean Squared Error, Binary Cross-Entropy, and optimization through gradient descent and momentum dynamics.',
    chunks: [
      {
        id: 'chk-opt-01',
        documentId: 'doc-opt-loss',
        courseId: 'course-ml-101',
        documentTitle: 'Lecture 03: Optimization Landscapes and Objective Functions.pdf',
        topic: 'Optimization & Loss Functions',
        subtopic: 'Mean Squared Error (MSE)',
        pageOrSlide: 4,
        text: 'Mean Squared Error (MSE) is the standard objective function for continuous regression tasks. Given N training observations, MSE calculates the average squared residual between target values y_i and model predictions y_hat_i:\n\nL_MSE = (1 / N) * SUM_{i=1}^N (y_i - y_hat_i)^2\n\nMSE penalizes large deviations quadratically, making it sensitive to extreme outliers. The gradient with respect to predicted output is linear: dL/dy_hat = -(2 / N) * (y - y_hat). When assuming Gaussian noise with spherical variance on the target variable, minimizing MSE is mathematically equivalent to Maximum Likelihood Estimation (MLE).',
        formulas: ['L_MSE = (1/N) * \\sum_{i=1}^N (y_i - \\hat{y}_i)^2', '\\frac{\\partial L}{\\partial \\hat{y}_i} = -\\frac{2}{N}(y_i - \\hat{y}_i)'],
        keywords: ['MSE', 'Mean Squared Error', 'continuous regression', 'residuals', 'outliers', 'Maximum Likelihood Estimation']
      },
      {
        id: 'chk-opt-02',
        documentId: 'doc-opt-loss',
        courseId: 'course-ml-101',
        documentTitle: 'Lecture 03: Optimization Landscapes and Objective Functions.pdf',
        topic: 'Optimization & Loss Functions',
        subtopic: 'Cross-Entropy Loss',
        pageOrSlide: 9,
        text: 'Cross-Entropy Loss, derived from Kullback-Leibler (KL) divergence in information theory, measures the discrepancy between true categorical distribution p and predicted distribution q. For binary classification with true label y in {0, 1} and predicted probability p in (0, 1):\n\nL_BCE = - [ y * ln(p) + (1 - y) * ln(1 - p) ]\n\nFor multi-class classification over C mutual classes with one-hot label vector y and softmax output vector p:\n\nL_CE = - SUM_{c=1}^C y_c * ln(p_c)\n\nUnlike MSE applied to probabilistic classification, Cross-Entropy provides steep gradients when predictions are confidently wrong, preventing gradient starvation in saturated neurons.',
        formulas: ['L_{BCE} = -[y\\ln(p) + (1-y)\\ln(1-p)]', 'L_{CE} = -\\sum_{c=1}^C y_c \\ln(p_c)'],
        keywords: ['Cross-Entropy', 'BCE', 'KL divergence', 'binary classification', 'multi-class', 'gradient starvation']
      },
      {
        id: 'chk-opt-03',
        documentId: 'doc-opt-loss',
        courseId: 'course-ml-101',
        documentTitle: 'Lecture 03: Optimization Landscapes and Objective Functions.pdf',
        topic: 'Optimization & Loss Functions',
        subtopic: 'Stochastic Gradient Descent',
        pageOrSlide: 14,
        text: 'Batch Gradient Descent computes gradients across the entire training dataset D at each iteration step: theta_{t+1} = theta_t - eta * nabla_theta L(D; theta_t), where eta is the learning rate. While deterministic and stable, batch updates become prohibitively expensive for millions of samples.\n\nStochastic Gradient Descent (SGD) approximates the true gradient using a single randomly sampled observation or mini-batch B of size m (commonly m in {32, 64, 128}):\n\ntheta_{t+1} = theta_t - eta * (1 / m) * SUM_{i in B} nabla_theta L(x_i, y_i; theta_t)\n\nThe stochasticity introduces variance, allowing parameters to escape shallow local minima and saddle points.',
        formulas: ['\\theta_{t+1} = \\theta_t - \\eta \\nabla_\\theta L(B; \\theta_t)'],
        keywords: ['SGD', 'Batch Gradient Descent', 'mini-batch', 'learning rate', 'saddle points', 'variance']
      },
      {
        id: 'chk-opt-04',
        documentId: 'doc-opt-loss',
        courseId: 'course-ml-101',
        documentTitle: 'Lecture 03: Optimization Landscapes and Objective Functions.pdf',
        topic: 'Optimization & Loss Functions',
        subtopic: 'Learning Rate & Momentum',
        pageOrSlide: 18,
        text: 'The learning rate eta dictates parameter step size along the negative gradient. If eta is excessively small, convergence stalls in plateau regions; if eta is excessively large, updates oscillate across ravines and diverge.\n\nMomentum accelerates SGD along persistent descent directions while dampening high-frequency oscillations across ravines by introducing velocity vector v_t:\n\nv_t = gamma * v_{t-1} + eta * nabla_theta L(theta_t)\ntheta_{t+1} = theta_t - v_t\n\nwhere gamma in [0.9, 0.99] is the momentum friction coefficient. Typical velocity accumulates past gradients as an exponentially decaying moving average with effective step multiplier 1 / (1 - gamma).',
        formulas: ['v_t = \\gamma v_{t-1} + \\eta \\nabla_\\theta L(\\theta_t)', '\\theta_{t+1} = \\theta_t - v_t'],
        keywords: ['momentum', 'learning rate', 'velocity', 'ravines', 'oscillations', 'exponential moving average']
      },
      {
        id: 'chk-opt-05',
        documentId: 'doc-opt-loss',
        courseId: 'course-ml-101',
        documentTitle: 'Lecture 03: Optimization Landscapes and Objective Functions.pdf',
        topic: 'Optimization & Loss Functions',
        subtopic: 'Learning Rate & Momentum',
        pageOrSlide: 22,
        text: 'Adaptive learning rate optimizers dynamically scale updates per parameter based on historical gradient magnitudes. AdaGrad accumulates squared historical gradients, but causes premature decay. RMSProp resolves this via exponential decay: s_t = beta * s_{t-1} + (1 - beta) * g_t^2.\n\nAdam (Adaptive Moment Estimation) combines first-moment momentum (m_t) and second-moment squared gradients (v_t) with bias corrections:\n\nm_hat_t = m_t / (1 - beta_1^t)\nv_hat_t = v_t / (1 - beta_2^t)\ntheta_{t+1} = theta_t - (eta / (sqrt(v_hat_t) + epsilon)) * m_hat_t\n\nStandard hyperparameters are beta_1 = 0.9, beta_2 = 0.999, and epsilon = 1e-8.',
        formulas: ['\\hat{m}_t = \\frac{m_t}{1 - \\beta_1^t}', '\\hat{v}_t = \\frac{v_t}{1 - \\beta_2^t}', '\\theta_{t+1} = \\theta_t - \\frac{\\eta}{\\sqrt{\\hat{v}_t} + \\epsilon} \\hat{m}_t'],
        keywords: ['Adam', 'RMSProp', 'AdaGrad', 'adaptive learning rate', 'bias correction']
      },
      {
        id: 'chk-opt-06',
        documentId: 'doc-opt-loss',
        courseId: 'course-ml-101',
        documentTitle: 'Lecture 03: Optimization Landscapes and Objective Functions.pdf',
        topic: 'Optimization & Loss Functions',
        subtopic: 'Mean Squared Error (MSE)',
        pageOrSlide: 26,
        text: 'Loss Surface Convexity: An objective function L is strictly convex if for all theta_1, theta_2 and lambda in (0, 1):\nL(lambda * theta_1 + (1 - lambda) * theta_2) < lambda * L(theta_1) + (1 - lambda) * L(theta_2).\n\nLinear models with MSE or Cross-Entropy possess convex loss landscapes with a unique global minimum. In contrast, multi-layer neural networks introduce non-linear composition, creating highly non-convex loss surfaces characterized by permutation symmetries, plateau saddles, and isolated bad local minima.',
        keywords: ['convexity', 'non-convex', 'global minimum', 'loss surface', 'saddle points']
      }
    ]
  },
  {
    id: 'doc-nn-backprop',
    courseId: 'course-ml-101',
    title: 'Lecture 05: Feedforward Networks and Reverse-Mode Differentiation.pptx',
    type: 'pptx',
    topic: 'Neural Architectures & Backpropagation',
    subtopics: ['Feedforward Computation', 'The Chain Rule of Calculus', 'Weight Gradient Derivation', 'Vanishing & Exploding Gradients'],
    totalChunks: 6,
    uploadedAt: '2026-09-17T11:00:00.000Z',
    fileSizeBytes: 3891200,
    summary: 'Mathematical formulation of multilayer perceptron forward passes, computation graphs, reverse-mode automatic differentiation, and numerical stability in gradient propagation.',
    chunks: [
      {
        id: 'chk-bp-01',
        documentId: 'doc-nn-backprop',
        courseId: 'course-ml-101',
        documentTitle: 'Lecture 05: Feedforward Networks and Reverse-Mode Differentiation.pptx',
        topic: 'Neural Architectures & Backpropagation',
        subtopic: 'Feedforward Computation',
        pageOrSlide: 3,
        text: 'A Feedforward Neural Network (Multilayer Perceptron) maps input vector x in R^{d_in} to prediction y_hat in R^{d_out} across L successive transformation layers. For layer l in {1, ..., L}:\n\nz^[l] = W^[l] * a^[l-1] + b^[l]\na^[l] = sigma(z^[l])\n\nwhere a^[0] = x represents network input, W^[l] in R^{n_l x n_{l-1}} is the weight matrix, b^[l] in R^{n_l} is the bias vector, and sigma(.) is an element-wise non-linear activation function. Vector z^[l] is termed the pre-activation vector, and a^[l] is the post-activation state vector.',
        formulas: ['z^{[l]} = W^{[l]} a^{[l-1]} + b^{[l]}', 'a^{[l]} = \\sigma(z^{[l]})'],
        keywords: ['feedforward', 'MLP', 'pre-activation', 'post-activation', 'weight matrix', 'bias vector']
      },
      {
        id: 'chk-bp-02',
        documentId: 'doc-nn-backprop',
        courseId: 'course-ml-101',
        documentTitle: 'Lecture 05: Feedforward Networks and Reverse-Mode Differentiation.pptx',
        topic: 'Neural Architectures & Backpropagation',
        subtopic: 'The Chain Rule of Calculus',
        pageOrSlide: 7,
        text: 'Backpropagation is an efficient realization of reverse-mode automatic differentiation. In a directed acyclic computation graph, if intermediate scalar variable y depends on intermediate variable u, and final scalar loss L depends on y, the univariate chain rule states:\n\ndL/du = (dL/dy) * (dy/du)\n\nIn multivariate vector calculus, for vector u in R^n producing vector y in R^m, the chain rule involves the Jacobian matrix J = dy/du:\n\nnabla_u L = (J_{y->u})^T * nabla_y L\n\nReverse-mode differentiation computes gradients of a scalar loss with respect to all network parameters in O(E) operations, where E is the number of edges, matching the asymptotic complexity of a single forward pass.',
        formulas: ['\\nabla_u L = \\left(\\frac{\\partial y}{\\partial u}\\right)^T \\nabla_y L'],
        keywords: ['chain rule', 'reverse-mode differentiation', 'Jacobian matrix', 'computation graph', 'asymptotic complexity']
      },
      {
        id: 'chk-bp-03',
        documentId: 'doc-nn-backprop',
        courseId: 'course-ml-101',
        documentTitle: 'Lecture 05: Feedforward Networks and Reverse-Mode Differentiation.pptx',
        topic: 'Neural Architectures & Backpropagation',
        subtopic: 'Weight Gradient Derivation',
        pageOrSlide: 12,
        text: 'Defining the error signal vector at layer l as delta^[l] = dL / dz^[l]:\nFor the output layer L with activation a^[L] and loss L:\ndelta^[L] = (dL / da^[L]) odot sigma_prime(z^[L])\n\nFor any hidden layer l < L, delta^[l] recurses backward through layer l+1:\ndelta^[l] = ((W^[l+1])^T * delta^[l+1]) odot sigma_prime(z^[l])\n\nOnce delta^[l] is computed, the exact parameter gradients are outer vector products:\ndL / dW^[l] = delta^[l] * (a^[l-1])^T\ndL / db^[l] = delta^[l]\n\nwhere odot denotes the Hadamard (element-wise) product.',
        formulas: [
          '\\delta^{[l]} = \\left((W^{[l+1]})^T \\delta^{[l+1]}\\right) \\odot \\sigma\'(z^{[l]})',
          '\\frac{\\partial L}{\\partial W^{[l]}} = \\delta^{[l]} (a^{[l-1]})^T',
          '\\frac{\\partial L}{\\partial b^{[l]}} = \\delta^{[l]}'
        ],
        keywords: ['error signal', 'delta vector', 'Hadamard product', 'weight gradient', 'backpropagation algorithm']
      },
      {
        id: 'chk-bp-04',
        documentId: 'doc-nn-backprop',
        courseId: 'course-ml-101',
        documentTitle: 'Lecture 05: Feedforward Networks and Reverse-Mode Differentiation.pptx',
        topic: 'Neural Architectures & Backpropagation',
        subtopic: 'Vanishing & Exploding Gradients',
        pageOrSlide: 16,
        text: 'The Vanishing Gradient Problem occurs during backpropagation through deep architectures. From the recurrence delta^[l] = (W^[l+1]^T delta^[l+1]) odot sigma_prime(z^[l]), expanding over k layers reveals repeated matrix multiplications:\n\ndelta^[l] = Product_{j=l}^{L-1} [ (W^[j+1])^T * diag(sigma_prime(z^[j])) ] * delta^[L]\n\nIf the maximum singular value of weight matrices ||W^[j]|| < 1 and activation derivatives |sigma_prime| <= 0.25 (as in Sigmoid), gradients decay exponentially with depth (O(gamma^k), gamma < 1). Early layers receive near-zero weight updates and fail to learn meaningful representations.',
        keywords: ['vanishing gradient', 'singular value', 'exponential decay', 'saturation', 'deep networks']
      },
      {
        id: 'chk-bp-05',
        documentId: 'doc-nn-backprop',
        courseId: 'course-ml-101',
        documentTitle: 'Lecture 05: Feedforward Networks and Reverse-Mode Differentiation.pptx',
        topic: 'Neural Architectures & Backpropagation',
        subtopic: 'Vanishing & Exploding Gradients',
        pageOrSlide: 20,
        text: 'Exploding Gradients occur when singular values of weight matrices exceed unity (||W^[j]|| > 1), causing backpropagated error signals to compound exponentially (O(gamma^k), gamma > 1). This induces floating-point NaN overflows and catastrophic divergence.\n\nKey Mitigations for Gradient Instability:\n1. Gradient Clipping: Rescales gradient vector g if its L2 norm exceeds threshold c: g_clipped = g * min(1, c / ||g||_2).\n2. Weight Initialization: Xavier/Glorot normal Var(W) = 2 / (n_in + n_out) for symmetric activations; He/Kaiming Var(W) = 2 / n_in for ReLU.\n3. Residual Skip Connections (ResNets): Adds identity mappings a^[l] = F(a^[l-1]) + a^[l-1], allowing gradients to flow backward uninhibited.',
        formulas: ['g_{clipped} = g \\cdot \\min\\left(1, \\frac{c}{\\|g\\|_2}\\right)', 'a^{[l]} = \\mathcal{F}(a^{[l-1]}) + a^{[l-1]}'],
        keywords: ['exploding gradients', 'gradient clipping', 'Xavier initialization', 'He initialization', 'skip connections', 'ResNet']
      },
      {
        id: 'chk-bp-06',
        documentId: 'doc-nn-backprop',
        courseId: 'course-ml-101',
        documentTitle: 'Lecture 05: Feedforward Networks and Reverse-Mode Differentiation.pptx',
        topic: 'Neural Architectures & Backpropagation',
        subtopic: 'Feedforward Computation',
        pageOrSlide: 24,
        text: 'Universal Approximation Theorem (Cybenko, 1989; Hornik, 1991): A standard feedforward neural network with a single hidden layer containing a finite number of neurons and continuous non-linear activation functions can approximate any continuous function f: [0, 1]^d -> R on compact subsets to arbitrary precision epsilon > 0.\n\nCrucially, the theorem guarantees existence but provides no bounds on the width required (which can be exponential), nor does it guarantee that gradient descent can efficiently learn the optimal parameters.',
        keywords: ['Universal Approximation Theorem', 'Cybenko', 'single hidden layer', 'representational capacity']
      }
    ]
  },
  {
    id: 'doc-activations',
    courseId: 'course-ml-101',
    title: 'Textbook Chapter 06: Non-Linear Activation Dynamics.md',
    type: 'markdown',
    topic: 'Activation Functions & Non-Linearity',
    subtopics: ['Sigmoid & Tanh Saturation', 'Rectified Linear Unit (ReLU)', 'Leaky ReLU & Parametric Variants', 'Softmax Probability Vectors'],
    totalChunks: 6,
    uploadedAt: '2026-09-24T09:15:00.000Z',
    fileSizeBytes: 1843200,
    summary: 'Comprehensive analysis of activation function profiles, derivative bounds, saturation dynamics, dying ReLU failure modes, and categorical probability normalization.',
    chunks: [
      {
        id: 'chk-act-01',
        documentId: 'doc-activations',
        courseId: 'course-ml-101',
        documentTitle: 'Textbook Chapter 06: Non-Linear Activation Dynamics.md',
        topic: 'Activation Functions & Non-Linearity',
        subtopic: 'Sigmoid & Tanh Saturation',
        pageOrSlide: 2,
        text: 'The Logistic Sigmoid function squashes real-valued inputs into the interval (0, 1):\n\nsigma(z) = 1 / (1 + exp(-z))\n\nIts derivative possesses an elegant algebraic form expressed in terms of its output:\nsigma_prime(z) = sigma(z) * (1 - sigma(z))\n\nThe maximum value of sigma_prime(z) occurs at z = 0, where sigma_prime(0) = 0.5 * (1 - 0.5) = 0.25. For |z| > 4, the function saturates, driving sigma_prime(z) -> 0. Furthermore, Sigmoid outputs are strictly positive (not zero-centered), which introduces systematic zig-zagging in parameter updates.',
        formulas: ['\\sigma(z) = \\frac{1}{1 + e^{-z}}', '\\sigma\'(z) = \\sigma(z)(1 - \\sigma(z))', '\\max \\sigma\'(z) = 0.25'],
        keywords: ['sigmoid', 'logistic', 'saturation', 'non-zero-centered', 'derivative bound', 'gradient decay']
      },
      {
        id: 'chk-act-02',
        documentId: 'doc-activations',
        courseId: 'course-ml-101',
        documentTitle: 'Textbook Chapter 06: Non-Linear Activation Dynamics.md',
        topic: 'Activation Functions & Non-Linearity',
        subtopic: 'Sigmoid & Tanh Saturation',
        pageOrSlide: 5,
        text: 'The Hyperbolic Tangent (Tanh) function is a scaled and shifted version of the logistic sigmoid that maps inputs to the open range (-1, 1):\n\ntanh(z) = (exp(z) - exp(-z)) / (exp(z) + exp(-z)) = 2 * sigma(2z) - 1\n\nIts derivative is:\ntanh_prime(z) = 1 - tanh^2(z)\n\nThe peak derivative occurs at z = 0 with tanh_prime(0) = 1.0. Because Tanh is strictly zero-centered (E[a] approx 0), gradients alternate signs naturally and train significantly faster than standard sigmoid networks. However, for large |z|, Tanh still suffers from gradient saturation.',
        formulas: ['\\tanh(z) = \\frac{e^z - e^{-z}}{e^z + e^{-z}}', '\\tanh\'(z) = 1 - \\tanh^2(z)'],
        keywords: ['tanh', 'hyperbolic tangent', 'zero-centered', 'saturation', 'faster convergence']
      },
      {
        id: 'chk-act-03',
        documentId: 'doc-activations',
        courseId: 'course-ml-101',
        documentTitle: 'Textbook Chapter 06: Non-Linear Activation Dynamics.md',
        topic: 'Activation Functions & Non-Linearity',
        subtopic: 'Rectified Linear Unit (ReLU)',
        pageOrSlide: 8,
        text: 'The Rectified Linear Unit (ReLU) (Nair & Hinton, 2010) defines a piecewise linear mapping:\n\nf(z) = max(0, z)\n\nIts subgradient is:\nf_prime(z) = 1 if z > 0, and 0 if z < 0 (undefined at z=0, set to 0 or 1 in practice).\n\nKey Advantages of ReLU:\n1. Non-saturating gradient: When z > 0, the derivative is exactly 1, completely preventing gradient attenuation in positive regimes.\n2. Computational efficiency: Requires only a threshold comparison instead of expensive transcendental exponentials.\n3. Induced sparsity: Yields true zeros for inactive neurons, promoting compact representations.',
        formulas: ['f(z) = \\max(0, z)', 'f\'(z) = \\begin{cases} 1 & z > 0 \\\\ 0 & z < 0 \\end{cases}'],
        keywords: ['ReLU', 'rectified linear unit', 'non-saturating', 'sparsity', 'computational efficiency']
      },
      {
        id: 'chk-act-04',
        documentId: 'doc-activations',
        courseId: 'course-ml-101',
        documentTitle: 'Textbook Chapter 06: Non-Linear Activation Dynamics.md',
        topic: 'Activation Functions & Non-Linearity',
        subtopic: 'Rectified Linear Unit (ReLU)',
        pageOrSlide: 11,
        text: 'The Dying ReLU Problem: If a large negative gradient update knocks a neuron\'s bias such that w^T x + b < 0 across all training examples, the neuron will continuously output 0. Because its derivative f_prime(z) = 0 for z < 0, no gradient can ever propagate through this neuron in subsequent backpropagation steps.\n\nThe neuron becomes permanently inactive (a "dead neuron"). In poorly initialized networks with high learning rates, up to 40% of hidden units can die irreversibly during early training epochs.',
        keywords: ['Dying ReLU', 'dead neurons', 'permanent inactivation', 'zero gradient', 'learning rate vulnerability']
      },
      {
        id: 'chk-act-05',
        documentId: 'doc-activations',
        courseId: 'course-ml-101',
        documentTitle: 'Textbook Chapter 06: Non-Linear Activation Dynamics.md',
        topic: 'Activation Functions & Non-Linearity',
        subtopic: 'Leaky ReLU & Parametric Variants',
        pageOrSlide: 14,
        text: 'Leaky ReLU addresses the dying neuron failure mode by introducing a small non-zero slope alpha (commonly alpha = 0.01) for negative inputs:\n\nf(z) = max(alpha * z, z) = z if z >= 0 else alpha * z\n\nIts derivative is f_prime(z) = 1 for z >= 0 and alpha for z < 0. Because alpha > 0, a slight gradient always flows backward, preventing irreversible neuron death.\n\nParametric ReLU (PReLU) elevates alpha into a learnable parameter updated via backpropagation: dL/dalpha = delta * z for z < 0.\nExponential Linear Unit (ELU) uses f(z) = alpha * (exp(z) - 1) for z < 0, smoothing the transition to zero and bringing mean activations closer to zero.',
        formulas: ['f(z) = \\max(\\alpha z, z)', 'f\'(z) = \\begin{cases} 1 & z \\ge 0 \\\\ \\alpha & z < 0 \\end{cases}'],
        keywords: ['Leaky ReLU', 'PReLU', 'ELU', 'negative slope', 'dead neuron mitigation']
      },
      {
        id: 'chk-act-06',
        documentId: 'doc-activations',
        courseId: 'course-ml-101',
        documentTitle: 'Textbook Chapter 06: Non-Linear Activation Dynamics.md',
        topic: 'Activation Functions & Non-Linearity',
        subtopic: 'Softmax Probability Vectors',
        pageOrSlide: 18,
        text: 'The Softmax function normalizes a real-valued logit vector z in R^C into a valid discrete probability distribution over C mutually exclusive classes:\n\np_i = softmax(z)_i = exp(z_i) / SUM_{j=1}^C exp(z_j)\n\nProperties:\n1. Non-negativity: p_i > 0 for all i.\n2. Normalization: SUM_{i=1}^C p_i = 1.\n3. Numerical Stability: To prevent exp(z_i) overflow, subtract the maximum logit: z_shifted = z - max(z).\n\nThe Jacobian matrix of softmax is J_{ij} = dp_i / dz_j = p_i * (delta_{ij} - p_j), where delta_{ij} is the Kronecker delta (1 if i=j, 0 otherwise). When combined with Cross-Entropy Loss, the gradient simplifies to: dL / dz_i = p_i - y_i.',
        formulas: [
          'p_i = \\frac{e^{z_i}}{\\sum_{j=1}^C e^{z_j}}',
          '\\frac{\\partial p_i}{\\partial z_j} = p_i (\\delta_{ij} - p_j)',
          '\\frac{\\partial L_{CE}}{\\partial z_i} = p_i - y_i'
        ],
        keywords: ['Softmax', 'logits', 'probability distribution', 'numerical stability', 'Kronecker delta', 'softmax gradient']
      }
    ]
  },
  {
    id: 'doc-reg-attention',
    courseId: 'course-ml-101',
    title: 'Transcript: Lecture 09 - Generalization, Regularization and Transformers.txt',
    type: 'transcript',
    topic: 'Regularization & Transformer Self-Attention',
    subtopics: ['L1 vs L2 Weight Decay', 'Dropout Regularization', 'Overfitting Diagnostics', 'Scaled Dot-Product Attention'],
    totalChunks: 6,
    uploadedAt: '2026-10-02T16:45:00.000Z',
    fileSizeBytes: 2150400,
    summary: 'Spoken transcript covering overfitting symptoms, L1/L2 penalties, weight decay, Dropout Bernoulli ensembles, and mathematical derivation of Scaled Dot-Product Attention.',
    chunks: [
      {
        id: 'chk-reg-01',
        documentId: 'doc-reg-attention',
        courseId: 'course-ml-101',
        documentTitle: 'Transcript: Lecture 09 - Generalization, Regularization and Transformers.txt',
        topic: 'Regularization & Transformer Self-Attention',
        subtopic: 'Overfitting Diagnostics',
        timestampStart: '02:15',
        timestampEnd: '07:40',
        text: '[02:15] Professor: Overfitting occurs when a statistical model with high capacity fits idiosyncratic training noise rather than the underlying data generating distribution. Empirically, training loss continuously decreases towards zero while validation error reaches a minimum and diverges upwards.\n\nBias-Variance Decomposition: Total Expected Test Error = Bias^2 + Variance + Irreducible Error sigma^2.\nModels with high bias underfit (rigid hypotheses); models with high variance overfit (excessive sensitivity to sample fluctuations). Regularization methods constrain model hypothesis complexity to minimize generalization error on unseen test distributions.',
        formulas: ['\\text{Error} = \\text{Bias}^2 + \\text{Variance} + \\sigma^2'],
        keywords: ['overfitting', 'bias-variance tradeoff', 'generalization error', 'validation loss divergence', 'irreducible error']
      },
      {
        id: 'chk-reg-02',
        documentId: 'doc-reg-attention',
        courseId: 'course-ml-101',
        documentTitle: 'Transcript: Lecture 09 - Generalization, Regularization and Transformers.txt',
        topic: 'Regularization & Transformer Self-Attention',
        subtopic: 'L1 vs L2 Weight Decay',
        timestampStart: '08:10',
        timestampEnd: '14:25',
        text: '[08:10] Professor: Weight regularization appends a parameter norm penalty Omega(W) to the empirical loss: J_reg(W) = L(W) + lambda * Omega(W), where lambda >= 0 is the regularization strength.\n\nL2 Regularization (Ridge / Weight Decay): Omega(W) = (1/2) * ||W||_2^2 = (1/2) * SUM w_j^2.\nGradient update: w_{t+1} = w_t - eta * (nabla L + lambda * w_t) = (1 - eta * lambda) * w_t - eta * nabla L.\nAt each step, weights are shrunken multiplicatively by (1 - eta * lambda) before gradient subtraction. L2 penalizes large weights heavily but keeps small non-zero values.\n\nL1 Regularization (Lasso): Omega(W) = ||W||_1 = SUM |w_j|.\nGradient update: w_{t+1} = w_t - eta * nabla L - eta * lambda * sgn(w_t). L1 subtracts a constant rate, driving parameters exactly to zero and producing sparse weight matrices.',
        formulas: [
          'J_{L2}(W) = L(W) + \\frac{\\lambda}{2} \\|W\\|_2^2',
          'w_{t+1} = (1 - \\eta \\lambda)w_t - \\eta \\nabla L',
          'J_{L1}(W) = L(W) + \\lambda \\|W\\|_1'
        ],
        keywords: ['L2 regularization', 'Ridge', 'weight decay', 'L1 regularization', 'Lasso', 'sparsity', 'parameter norm']
      },
      {
        id: 'chk-reg-03',
        documentId: 'doc-reg-attention',
        courseId: 'course-ml-101',
        documentTitle: 'Transcript: Lecture 09 - Generalization, Regularization and Transformers.txt',
        topic: 'Regularization & Transformer Self-Attention',
        subtopic: 'Dropout Regularization',
        timestampStart: '15:00',
        timestampEnd: '21:30',
        text: '[15:00] Professor: Dropout (Srivastava et al., 2014) is a computationally efficient stochastic regularization technique. During each training forward pass, each hidden unit is independently dropped (zeroed out) with retention probability p (or drop probability 1 - p = 0.5) drawn from a Bernoulli distribution:\n\nr^[l] ~ Bernoulli(p)\na_tilde^[l] = (r^[l] odot a^[l]) / p  (Inverted Dropout scaling)\n\nInverted dropout divides by p at train time so that no scaling is required at test inference time. Dropout breaks co-adaptation between co-dependent neurons, forcing each feature detector to be independently useful. Asymptotically, dropout acts as an ensemble of 2^N sub-networks sharing parameters.',
        formulas: ['r^{[l]} \\sim \\text{Bernoulli}(p)', '\\tilde{a}^{[l]} = \\frac{r^{[l]} \\odot a^{[l]}}{p}'],
        keywords: ['Dropout', 'Bernoulli distribution', 'co-adaptation', 'Inverted Dropout', 'ensemble approximation']
      },
      {
        id: 'chk-reg-04',
        documentId: 'doc-reg-attention',
        courseId: 'course-ml-101',
        documentTitle: 'Transcript: Lecture 09 - Generalization, Regularization and Transformers.txt',
        topic: 'Regularization & Transformer Self-Attention',
        subtopic: 'Overfitting Diagnostics',
        timestampStart: '22:05',
        timestampEnd: '26:50',
        text: '[22:05] Professor: Early Stopping is an algorithmic regularization strategy based on validation set performance. We monitor validation loss L_val at each training epoch. As training proceeds, parameters navigate from underfitting towards optimal generalization.\n\nWhen L_val ceases to improve for a pre-defined patience window (e.g., 10 epochs), training halts and parameters are restored to the checkpoint corresponding to the minimum validation loss. Under quadratic loss approximations, Early Stopping with gradient descent is mathematically equivalent to L2 weight decay, where number of iterations t plays the reciprocal role of regularization penalty lambda.',
        keywords: ['Early Stopping', 'validation patience', 'checkpointing', 'algorithmic regularization', 'patience window']
      },
      {
        id: 'chk-reg-05',
        documentId: 'doc-reg-attention',
        courseId: 'course-ml-101',
        documentTitle: 'Transcript: Lecture 09 - Generalization, Regularization and Transformers.txt',
        topic: 'Regularization & Transformer Self-Attention',
        subtopic: 'Scaled Dot-Product Attention',
        timestampStart: '27:10',
        timestampEnd: '34:15',
        text: '[27:10] Professor: Scaled Dot-Product Attention (Vaswani et al., 2017) maps query matrix Q, key matrix K, and value matrix V to output representation:\n\nAttention(Q, K, V) = softmax( (Q * K^T) / sqrt(d_k) ) * V\n\nwhere d_k is the dimension of the key vectors. The dot product q_i * k_j measures affinity between query i and key j. Softmax converts affinity logits into normalized weights summing to 1 across keys.\n\nWhy divide by sqrt(d_k)? If query and key components are independent random variables with zero mean and unit variance, their dot product has mean 0 and variance d_k. For large d_k (e.g., 64 or 128), dot products grow large in magnitude, pushing softmax into saturated regimes with vanishingly small gradients. Scaling by 1 / sqrt(d_k) restores variance to unity.',
        formulas: [
          '\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V',
          '\\text{Var}\\left(q \\cdot k\\right) = d_k'
        ],
        keywords: ['Scaled Dot-Product Attention', 'Transformers', 'Vaswani', 'query', 'key', 'value', 'scaling factor', 'softmax saturation']
      },
      {
        id: 'chk-reg-06',
        documentId: 'doc-reg-attention',
        courseId: 'course-ml-101',
        documentTitle: 'Transcript: Lecture 09 - Generalization, Regularization and Transformers.txt',
        topic: 'Regularization & Transformer Self-Attention',
        subtopic: 'Scaled Dot-Product Attention',
        timestampStart: '34:40',
        timestampEnd: '41:00',
        text: '[34:40] Professor: Multi-Head Attention projects Q, K, and V into h distinct lower-dimensional subspaces using learnable projection matrices W_i^Q, W_i^K, and W_i^V of dimension d_model x d_k:\n\nhead_i = Attention(Q * W_i^Q, K * W_i^K, V * W_i^V)\nMultiHead(Q, K, V) = Concat(head_1, ..., head_h) * W^O\n\nwhere W^O in R^{(h * d_v) x d_model}. Multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions. A single attention head tends to average out positions, while multiple heads capture syntax, semantics, and coreference simultaneously.',
        formulas: [
          '\\text{head}_i = \\text{Attention}(Q W_i^Q, K W_i^K, V W_i^V)',
          '\\text{MultiHead}(Q, K, V) = \\text{Concat}(\\text{head}_1, \\dots, \\text{head}_h) W^O'
        ],
        keywords: ['Multi-Head Attention', 'projection matrices', 'subspaces', 'Transformer architecture', 'syntactic relations']
      }
    ]
  }
];

export const LINUX_CA1_DOCUMENT: DocumentSource = {
  id: 'doc-linux-ca1',
  courseId: 'course-linux-302',
  title: 'CS302 Systems Administration Midterm Exam - CA1.pdf',
  type: 'pdf',
  topic: 'Linux CLI & File Management',
  subtopics: ['Question 1', 'Question 2', 'Question 3', 'Question 4'],
  totalChunks: 4,
  uploadedAt: '2026-09-18T10:00:00.000Z',
  fileSizeBytes: 1048576,
  summary: 'Midterm exam covering essential Linux command line operations: hidden files, head/tail, and cp vs mv.',
  chunks: [
    {
      id: 'chk-linux-ca1-p1-1',
      documentId: 'doc-linux-ca1',
      courseId: 'course-linux-302',
      documentTitle: 'CS302 Systems Administration Midterm Exam - CA1.pdf',
      topic: 'Linux CLI & File Management',
      subtopic: 'Question 1',
      pageOrSlide: 1,
      text: '1. Which command displays hidden files?\nAnswer: ls -la or ls -a displays all files including hidden files starting with a dot.',
      keywords: ['ls', 'hidden', 'files', 'command', '-la', '-a']
    },
    {
      id: 'chk-linux-ca1-p1-2',
      documentId: 'doc-linux-ca1',
      courseId: 'course-linux-302',
      documentTitle: 'CS302 Systems Administration Midterm Exam - CA1.pdf',
      topic: 'Linux CLI & File Management',
      subtopic: 'Question 2',
      pageOrSlide: 1,
      text: '2. Which command displays the last 10 lines of a file?\nAnswer: tail -n 10 filename displays the last 10 lines of the specified file.',
      keywords: ['tail', 'last', 'lines', 'command', 'filename', '-n']
    },
    {
      id: 'chk-linux-ca1-p2-1',
      documentId: 'doc-linux-ca1',
      courseId: 'course-linux-302',
      documentTitle: 'CS302 Systems Administration Midterm Exam - CA1.pdf',
      topic: 'Linux CLI & File Management',
      subtopic: 'Question 3',
      pageOrSlide: 2,
      text: '3. Which command displays the first 10 lines of a file?\nAnswer: head -n 10 filename displays the first 10 lines of the specified file.',
      keywords: ['head', 'first', 'lines', 'command', 'filename', '-n']
    },
    {
      id: 'chk-linux-ca1-p2-2',
      documentId: 'doc-linux-ca1',
      courseId: 'course-linux-302',
      documentTitle: 'CS302 Systems Administration Midterm Exam - CA1.pdf',
      topic: 'Linux CLI & File Management',
      subtopic: 'Question 4',
      pageOrSlide: 2,
      text: '4. What is the difference between cp and mv?\nAnswer: cp creates a duplicate copy leaving the source intact, whereas mv renames or moves the file, removing it from its original location.',
      keywords: ['cp', 'mv', 'difference', 'copy', 'move', 'rename']
    }
  ]
};

export const PROBLEM_STATEMENTS_DOCUMENT: DocumentSource = {
  id: 'doc-hackathon-problem-statements',
  courseId: 'course-ml-101',
  title: 'Problem Statements.pdf',
  type: 'pdf',
  topic: 'Hackathon Problem Statements',
  subtopics: [
    'Track A: Cardiovascular Risk Visualization & Prediction',
    'Track B: Mapping Flood Damage from Space',
    'Track C: Contrastive Speech Analytics & Temporal Flaw Grounding',
    'Track D: Personalized Tutoring & Adaptive Learning'
  ],
  totalChunks: 4,
  uploadedAt: '2026-03-10T10:00:00Z',
  fileSizeBytes: 48200,
  summary: 'Extracted 2 pages (4 verified track passages with preserved page citations).',
  chunks: [
    {
      id: 'chk-ps-p1-track-a',
      documentId: 'doc-hackathon-problem-statements',
      courseId: 'course-ml-101',
      documentTitle: 'Problem Statements.pdf',
      topic: 'Track A: Cardiovascular Risk Visualization & Prediction',
      subtopic: 'Cardiovascular Risk Visualization & Prediction',
      pageOrSlide: 1,
      text: 'Track A: Cardiovascular Risk Visualization & Prediction\nTrack A focuses on developing predictive models and interactive clinical visual dashboards for cardiovascular health. Participants design multimodal architectures that integrate patient electronic health records (EHR), biometric sensor streams, and longitudinal diagnostic metrics to predict 10-year ischemic heart disease risk and present interpretable risk trajectory visualizers for clinical practitioners.',
      keywords: ['cardiovascular', 'risk', 'prediction', 'visualization', 'clinical', 'ehr', 'biometric']
    },
    {
      id: 'chk-ps-p1-track-b',
      documentId: 'doc-hackathon-problem-statements',
      courseId: 'course-ml-101',
      documentTitle: 'Problem Statements.pdf',
      topic: 'Track B: Mapping Flood Damage from Space',
      subtopic: 'Mapping Flood Damage from Space',
      pageOrSlide: 1,
      text: 'Track B: Mapping Flood Damage from Space\nTrack B challenges participants to harness Earth observation data, synthetic aperture radar (SAR), and multispectral satellite imagery to detect real-time flood inundation extents. Solutions must accurately delineate submerged infrastructure, estimate regional economic damages, and generate automated emergency response spatial heatmaps for disaster relief organizations.',
      keywords: ['flood', 'damage', 'space', 'satellite', 'sar', 'mapping', 'geospatial', 'disaster']
    },
    {
      id: 'chk-ps-p2-track-c',
      documentId: 'doc-hackathon-problem-statements',
      courseId: 'course-ml-101',
      documentTitle: 'Problem Statements.pdf',
      topic: 'Track C: Contrastive Speech Analytics & Temporal Flaw Grounding',
      subtopic: 'Contrastive Speech Analytics & Temporal Flaw Grounding',
      pageOrSlide: 2,
      text: 'Track C: Contrastive Speech Analytics & Temporal Flaw Grounding\nTrack C centers on temporal acoustic analysis, contrastive audio-text representations, and speech prosody evaluation. Teams construct speech analytics pipelines that detect phonetic inconsistencies, mispronunciations, and pacing flaws in spoken technical presentations, providing second-by-second temporal flaw grounding and actionable coaching feedback.',
      keywords: ['speech', 'analytics', 'contrastive', 'temporal', 'prosody', 'phonetic', 'coaching']
    },
    {
      id: 'chk-ps-p2-track-d',
      documentId: 'doc-hackathon-problem-statements',
      courseId: 'course-ml-101',
      documentTitle: 'Problem Statements.pdf',
      topic: 'Track D: Personalized Tutoring & Adaptive Learning',
      subtopic: 'Personalized Tutoring & Adaptive Learning',
      pageOrSlide: 2,
      text: 'Track D: Personalized Tutoring & Adaptive Learning\nTrack D focuses on engineering intelligent multimodal tutoring platforms that deliver adaptive, curriculum-aligned pedagogy. Systems must perform strict source-grounded retrieval over educational course materials, dynamically tailor explanation depth to individual student mastery levels, identify prerequisite concept deficiencies, and provide verifiable citations without hallucination.',
      keywords: ['tutoring', 'personalized', 'adaptive', 'learning', 'grounding', 'pedagogy', 'retrieval', 'track-d']
    }
  ]
};

export const SAMPLE_EVALUATION_CASES: EvaluationTestCase[] = [
  {
    id: 'eval-01',
    category: 'direct-fact',
    question: 'What is the mathematical formulation of Mean Squared Error (MSE) and why is it sensitive to outliers?',
    targetChunkIds: ['chk-opt-01'],
    referenceAnswer: 'MSE is (1/N) * sum_{i=1}^N (y_i - y_hat_i)^2. It is sensitive to outliers because it squares the residual error, penalizing large discrepancies quadratically.',
    expectedRefusal: false,
    difficulty: 'easy'
  },
  {
    id: 'eval-02',
    category: 'direct-fact',
    question: 'What is the maximum derivative value of the standard logistic sigmoid function, and at what input value does it occur?',
    targetChunkIds: ['chk-act-01'],
    referenceAnswer: 'The maximum derivative of the logistic sigmoid function is 0.25, and it occurs at input z = 0.',
    expectedRefusal: false,
    difficulty: 'easy'
  },
  {
    id: 'eval-03',
    category: 'direct-fact',
    question: 'Why does the Scaled Dot-Product Attention divide the dot products of Q and K by the square root of d_k?',
    targetChunkIds: ['chk-reg-05'],
    referenceAnswer: 'For independent zero-mean unit-variance components, the dot product has variance equal to d_k. For large d_k, dot products grow large and push softmax into saturated regions with vanishing gradients. Dividing by sqrt(d_k) restores the variance to 1.',
    expectedRefusal: false,
    difficulty: 'medium'
  },
  {
    id: 'eval-04',
    category: 'direct-fact',
    question: 'How does Inverted Dropout scale activations during the training phase?',
    targetChunkIds: ['chk-reg-03'],
    referenceAnswer: 'Inverted Dropout divides the retained activations by the keep probability p during training (a_tilde = (r * a) / p), ensuring that no scaling adjustment is necessary at test/inference time.',
    expectedRefusal: false,
    difficulty: 'medium'
  },
  {
    id: 'eval-05',
    category: 'direct-fact',
    question: 'What is the recurrence relation for the error signal vector delta at hidden layer l during backpropagation?',
    targetChunkIds: ['chk-bp-03'],
    referenceAnswer: 'delta^[l] = ((W^[l+1])^T * delta^[l+1]) odot sigma_prime(z^[l]), where odot represents the Hadamard element-wise product.',
    expectedRefusal: false,
    difficulty: 'hard'
  },
  {
    id: 'eval-06',
    category: 'direct-fact',
    question: 'What failure mode causes the "Dying ReLU" phenomenon in neural networks?',
    targetChunkIds: ['chk-act-03', 'chk-act-04'],
    referenceAnswer: 'If a large negative update pushes pre-activation z < 0 for all training inputs, the neuron continuously outputs 0 with a zero derivative, preventing any gradient flow and causing permanent inactivation.',
    expectedRefusal: false,
    difficulty: 'medium'
  },
  {
    id: 'eval-07',
    category: 'multi-chunk-synthesis',
    question: 'Compare how L1 and L2 weight regularization affect model parameter sparsity and explain their parameter update rules.',
    targetChunkIds: ['chk-reg-02'],
    referenceAnswer: 'L2 regularization adds (lambda/2)*||W||_2^2, multiplicatively shrinking weights by (1 - eta*lambda) per step and keeping non-zero weights. L1 regularization adds lambda*||W||_1, subtracting a constant rate eta*lambda*sgn(w), which drives parameters to exactly zero and produces sparse representations.',
    expectedRefusal: false,
    difficulty: 'medium'
  },
  {
    id: 'eval-08',
    category: 'multi-chunk-synthesis',
    question: 'How do the vanishing gradient issues caused by Sigmoid activations relate to the architectural mitigations introduced by ResNets?',
    targetChunkIds: ['chk-bp-04', 'chk-bp-05', 'chk-act-01'],
    referenceAnswer: 'Sigmoid has a maximum derivative of 0.25, causing backpropagated error signals to decay exponentially as (0.25)^L across L layers. ResNets mitigate this through residual skip connections (a^[l] = F(a^[l-1]) + a^[l-1]), providing an uninterrupted identity gradient path during backpropagation.',
    expectedRefusal: false,
    difficulty: 'hard'
  },
  {
    id: 'eval-09',
    category: 'multi-chunk-synthesis',
    question: 'Contrast Cross-Entropy Loss with MSE when training classification networks with saturated output layers.',
    targetChunkIds: ['chk-opt-01', 'chk-opt-02', 'chk-act-06'],
    referenceAnswer: 'When MSE is paired with sigmoid or softmax outputs, confident incorrect predictions yield near-zero output derivatives (gradient starvation). Cross-Entropy cancels out the derivative of softmax (dL/dz_i = p_i - y_i), providing steep, linear error gradients even when predictions are highly erroneous.',
    expectedRefusal: false,
    difficulty: 'hard'
  },
  {
    id: 'eval-10',
    category: 'multi-chunk-synthesis',
    question: 'How do Momentum and Adam optimizers accelerate convergence compared to standard mini-batch SGD in ravines?',
    targetChunkIds: ['chk-opt-03', 'chk-opt-04', 'chk-opt-05'],
    referenceAnswer: 'SGD exhibits high-frequency oscillations across steep ravines. Momentum accumulates velocity along persistent descent directions while dampening oscillations via an exponential moving average. Adam combines first-moment momentum with second-moment squared gradient scaling and bias correction.',
    expectedRefusal: false,
    difficulty: 'hard'
  },
  {
    id: 'eval-11',
    category: 'diagram-reasoning',
    question: 'Explain the dimensional mapping and projection matrices in Multi-Head Attention from Q, K, V to output.',
    targetChunkIds: ['chk-reg-06'],
    referenceAnswer: 'Queries, Keys, and Values of dimension d_model are projected into h heads of dimension d_k using matrices W_i^Q, W_i^K, and W_i^V. Each head computes Attention(Q W_i^Q, K W_i^K, V W_i^V). The h head outputs are concatenated and multiplied by projection matrix W^O (dimension (h*d_v) x d_model).',
    expectedRefusal: false,
    difficulty: 'medium'
  },
  {
    id: 'eval-12',
    category: 'diagram-reasoning',
    question: 'What is the formula and Jacobian matrix for the Softmax activation function over C classes?',
    targetChunkIds: ['chk-act-06'],
    referenceAnswer: 'p_i = exp(z_i) / sum_{j=1}^C exp(z_j). Its Jacobian matrix is dp_i / dz_j = p_i * (delta_ij - p_j), where delta_ij is the Kronecker delta.',
    expectedRefusal: false,
    difficulty: 'hard'
  },
  {
    id: 'eval-13',
    category: 'unsupported-refusal',
    question: 'How does Grover\'s quantum search algorithm achieve quadratic speedup over classical unstructured search using unitary diffusion operators?',
    targetChunkIds: [],
    referenceAnswer: 'REFUSAL_EXPECTED: The uploaded course material on Machine Learning & Neural Networks does not contain information on Grover\'s quantum algorithm or quantum computing diffusion operators.',
    expectedRefusal: true,
    difficulty: 'easy'
  },
  {
    id: 'eval-14',
    category: 'unsupported-refusal',
    question: 'Explain the military tactics of Scipio Africanus at the Battle of Zama in 202 BC against Hannibal.',
    targetChunkIds: [],
    referenceAnswer: 'REFUSAL_EXPECTED: The uploaded course material covers Machine Learning, neural network backpropagation, and transformers, with no historical documentation regarding the Battle of Zama or Roman military history.',
    expectedRefusal: true,
    difficulty: 'easy'
  },
  {
    id: 'eval-15',
    category: 'unsupported-refusal',
    question: 'What are the recommended dosage guidelines and pharmacokinetics of intravenous Remdesivir in renal impairment patients?',
    targetChunkIds: [],
    referenceAnswer: 'REFUSAL_EXPECTED: The uploaded course material does not contain pharmacology, medical prescriptions, or clinical trial documentation for Remdesivir.',
    expectedRefusal: true,
    difficulty: 'easy'
  },
  {
    id: 'eval-linux-01',
    category: 'direct-fact',
    question: 'Which command displays hidden files?',
    targetChunkIds: ['chk-linux-ca1-p1-1'],
    referenceAnswer: 'ls -la (or ls -a) displays all files including hidden files starting with a dot.',
    expectedRefusal: false,
    difficulty: 'easy'
  },
  {
    id: 'eval-linux-02',
    category: 'direct-fact',
    question: 'Which command displays the last 10 lines of a file?',
    targetChunkIds: ['chk-linux-ca1-p1-2'],
    referenceAnswer: 'tail -n 10 filename displays the last 10 lines of the specified file.',
    expectedRefusal: false,
    difficulty: 'easy'
  },
  {
    id: 'eval-linux-03',
    category: 'direct-fact',
    question: 'Which command displays the first 10 lines of a file?',
    targetChunkIds: ['chk-linux-ca1-p2-1'],
    referenceAnswer: 'head -n 10 filename displays the first 10 lines of the specified file.',
    expectedRefusal: false,
    difficulty: 'easy'
  },
  {
    id: 'eval-linux-04',
    category: 'direct-fact',
    question: 'What is the difference between cp and mv?',
    targetChunkIds: ['chk-linux-ca1-p2-2'],
    referenceAnswer: 'cp creates a duplicate copy leaving the source intact, whereas mv renames or moves the file, removing it from its original location.',
    expectedRefusal: false,
    difficulty: 'easy'
  },
  {
    id: 'eval-track-d-01',
    category: 'direct-fact',
    question: 'What is Track D about?',
    targetChunkIds: ['chk-ps-p2-track-d'],
    referenceAnswer: 'Track D focuses on engineering intelligent multimodal tutoring platforms that deliver adaptive, curriculum-aligned pedagogy, perform strict source-grounded retrieval over educational course materials, and provide verifiable citations without hallucination.',
    expectedRefusal: false,
    difficulty: 'easy'
  },
  {
    id: 'eval-track-d-refusal',
    category: 'unsupported-refusal',
    question: 'How does backpropagation compute gradients for convolutional layers?',
    targetChunkIds: [],
    referenceAnswer: 'The uploaded document does not provide enough evidence to answer this question.',
    expectedRefusal: true,
    difficulty: 'easy'
  }
];
