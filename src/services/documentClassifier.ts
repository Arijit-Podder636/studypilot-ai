/**
 * Content-Based Document and Passage Topic Classifier
 *
 * Classifies document subjects and chunk topics strictly from genuine extracted text content,
 * preventing unrelated courses (e.g. Machine Learning) from imposing topics (e.g. "Optimization & Loss Functions")
 * on hackathon challenge tracks, Linux sysadmin notes, or unclassified documents.
 */

export interface ClassificationResult {
  subject: string;
  category: 'hackathon' | 'linux' | 'machine-learning' | 'unclassified';
  confidence: number;
  detectedTopics: string[];
  isReliable: boolean;
}

export interface PassageTopicInfo {
  topic: string;
  subtopic: string;
  keywords: string[];
}

export class DocumentClassifier {
  /**
   * Analyzes extracted page body texts to determine genuine document subject.
   * Body text is the primary source of truth; filenames are only used as supplementary hints
   * when body text provides sufficient corroborating domain evidence.
   */
  public static classify(fileName: string, pageTexts: string[]): ClassificationResult {
    const bodyText = (pageTexts || []).join(' ').toLowerCase();

    // If body text is empty or has virtually no content, do not classify based on filename alone
    if (bodyText.trim().length < 20) {
      return {
        subject: 'Unclassified',
        category: 'unclassified',
        confidence: 0,
        detectedTopics: [],
        isReliable: false
      };
    }

    // 1. Hackathon Problem Statements / Challenge Tracks
    const hasHackathonTerm = bodyText.includes('hackathon') || bodyText.includes('challenge track') || bodyText.includes('problem statement');
    const hasTrackMarker = /track\s+[a-d]/i.test(bodyText) || (bodyText.includes('cardiovascular') && bodyText.includes('flood damage'));
    const isHackathon = hasHackathonTerm && hasTrackMarker ||
      (bodyText.includes('track a') && bodyText.includes('track b')) ||
      (bodyText.includes('problem statement') && hasTrackMarker);

    if (isHackathon) {
      // Only attach hackathon track descriptions that ACTUALLY appear in the document body
      const detectedTopics: string[] = [];
      if (bodyText.includes('track a') || bodyText.includes('cardiovascular')) {
        detectedTopics.push('Track A: Cardiovascular Risk Visualization & Prediction');
      }
      if (bodyText.includes('track b') || bodyText.includes('flood')) {
        detectedTopics.push('Track B: Mapping Flood Damage from Space');
      }
      if (bodyText.includes('track c') || (bodyText.includes('contrastive') && bodyText.includes('speech'))) {
        detectedTopics.push('Track C: Contrastive Speech Analytics & Temporal Flaw Grounding');
      }
      if (bodyText.includes('track d') || (bodyText.includes('tutoring') && bodyText.includes('adaptive'))) {
        detectedTopics.push('Track D: Personalized Tutoring & Adaptive Learning');
      }

      if (detectedTopics.length === 0) {
        detectedTopics.push('Hackathon Problem Statements');
      }

      return {
        subject: 'Hackathon Problem Statements',
        category: 'hackathon',
        confidence: 0.95,
        detectedTopics,
        isReliable: true
      };
    }

    // 2. Linux Systems Administration & Shell Automation
    const linuxKeywords = [
      'linux', 'sysadmin', 'systems administration', 'bash', 'terminal', 'cli',
      'shell', 'hidden files', 'command', 'grep', 'chmod', 'chown', 'tail -n',
      'head -n', 'cp and mv', 'stdout', 'stdin', 'posix'
    ];
    const linuxMatchCount = linuxKeywords.filter(k => bodyText.includes(k)).length;
    const isExplicitLinux = bodyText.includes('linux') || bodyText.includes('systems administration') || bodyText.includes('cs302');
    const isLinux = (isExplicitLinux && linuxMatchCount >= 2) || linuxMatchCount >= 3;

    if (isLinux) {
      const detectedTopics: string[] = [];
      if (bodyText.includes('hidden files') || bodyText.includes('ls ') || bodyText.includes('cp and mv') || bodyText.includes('head') || bodyText.includes('tail')) {
        detectedTopics.push('Linux CLI & File Management');
      }
      if (bodyText.includes('chmod') || bodyText.includes('chown') || bodyText.includes('permission')) {
        detectedTopics.push('Permissions & User Management');
      }
      if (bodyText.includes('ps') || bodyText.includes('kill') || bodyText.includes('process')) {
        detectedTopics.push('Process Control & Signals');
      }
      if (detectedTopics.length === 0) {
        detectedTopics.push('Linux CLI & File Management');
      }

      return {
        subject: 'Linux Systems Administration',
        category: 'linux',
        confidence: 0.95,
        detectedTopics,
        isReliable: true
      };
    }

    // 3. Machine Learning Foundations
    // NOTE: An isolated word "transformer" MUST NOT classify as Machine Learning (could be electrical engineering).
    // ML requires explicit compound phrases OR multiple distinct ML indicators.
    const strongMlPhrases = [
      'gradient descent', 'loss function', 'backpropagation', 'cross-entropy',
      'mean squared error', 'neural network', 'deep learning', 'activation function',
      'learning rate', 'weight decay', 'regularization', 'overfitting'
    ];
    const hasStrongPhrase = strongMlPhrases.some(p => bodyText.includes(p));

    // For "transformer", require co-occurrence with attention, tokens, neural, or architecture
    const hasTransformerMl = bodyText.includes('transformer') && (
      bodyText.includes('attention') || bodyText.includes('self-attention') ||
      bodyText.includes('token') || bodyText.includes('embedding') ||
      bodyText.includes('layer') || bodyText.includes('neural')
    );

    const mlConceptTokens = [
      'gradient', 'loss', 'optimization', 'epoch', 'backprop', 'hyperparameter',
      'convolutional', 'perceptron', 'relu', 'sigmoid', 'softmax'
    ];
    const mlConceptMatches = mlConceptTokens.filter(t => bodyText.includes(t)).length;

    const isMachineLearning = hasStrongPhrase || hasTransformerMl || mlConceptMatches >= 3;

    if (isMachineLearning) {
      const detectedTopics: string[] = [];
      if (bodyText.includes('gradient') || bodyText.includes('loss') || bodyText.includes('optimizer')) {
        detectedTopics.push('Optimization & Loss Functions');
      }
      if (bodyText.includes('backpropagation') || bodyText.includes('network') || bodyText.includes('perceptron')) {
        detectedTopics.push('Neural Network Architectures');
      }
      if (bodyText.includes('attention') || bodyText.includes('transformer')) {
        detectedTopics.push('Attention Mechanisms & Transformers');
      }
      if (bodyText.includes('regularization') || bodyText.includes('overfitting') || bodyText.includes('weight decay')) {
        detectedTopics.push('Generalization & Regularization');
      }
      if (detectedTopics.length === 0) {
        detectedTopics.push('Machine Learning Foundations');
      }

      return {
        subject: 'Machine Learning Foundations',
        category: 'machine-learning',
        confidence: 0.90,
        detectedTopics,
        isReliable: true
      };
    }

    // 4. Insufficient evidence -> Unclassified
    return {
      subject: 'Unclassified',
      category: 'unclassified',
      confidence: 0,
      detectedTopics: [],
      isReliable: false
    };
  }

  /**
   * Determines chunk-specific topic, subtopic, and keywords for a given passage.
   */
  public static classifyPassage(
    passage: string,
    docCategory: 'hackathon' | 'linux' | 'machine-learning' | 'unclassified',
    docSubject: string,
    pageNumber: number,
    passageIndex: number
  ): PassageTopicInfo {
    const lower = passage.toLowerCase();

    if (docCategory === 'hackathon') {
      if (lower.includes('track a') || lower.includes('cardiovascular')) {
        return {
          topic: 'Track A: Cardiovascular Risk Visualization & Prediction',
          subtopic: 'Cardiovascular Risk Visualization & Prediction',
          keywords: ['cardiovascular', 'risk-prediction', 'clinical-dashboards', 'ehr', 'biometric', 'longitudinal']
        };
      }
      if (lower.includes('track b') || lower.includes('flood damage')) {
        return {
          topic: 'Track B: Mapping Flood Damage from Space',
          subtopic: 'Mapping Flood Damage from Space',
          keywords: ['flood-damage', 'satellite-imagery', 'sar', 'geospatial', 'disaster-response', 'infrastructure']
        };
      }
      if (lower.includes('track c') || lower.includes('contrastive speech')) {
        return {
          topic: 'Track C: Contrastive Speech Analytics & Temporal Flaw Grounding',
          subtopic: 'Contrastive Speech Analytics & Temporal Flaw Grounding',
          keywords: ['speech-analytics', 'contrastive-audio', 'temporal-flaws', 'prosody', 'pronunciation', 'phonetic']
        };
      }
      if (lower.includes('track d') || lower.includes('personalized tutoring')) {
        return {
          topic: 'Track D: Personalized Tutoring & Adaptive Learning',
          subtopic: 'Personalized Tutoring & Adaptive Learning',
          keywords: ['personalized-tutoring', 'adaptive-learning', 'grounded-rag', 'mastery-learning', 'pedagogy', 'curriculum']
        };
      }
      return {
        topic: 'Hackathon Problem Statements',
        subtopic: `Page ${pageNumber} · Section ${passageIndex + 1}`,
        keywords: ['hackathon', 'problem-statements', 'challenge']
      };
    }

    if (docCategory === 'linux') {
      const questionMatch = passage.match(/^(?:Q(?:uestion)?\s*(\d+)[\.:\)]?|(\d+)[\.\)]\s+|(?:Exercise|Problem|Task)\s*(\d+)[\.:]?)/i);
      const qNum = questionMatch ? (questionMatch[1] || questionMatch[2] || questionMatch[3]) : null;
      return {
        topic: 'Linux CLI & File Management',
        subtopic: qNum ? `Question ${qNum}` : `Page ${pageNumber} · Section ${passageIndex + 1}`,
        keywords: ['linux', 'cli', 'bash', 'terminal']
      };
    }

    if (docCategory === 'machine-learning') {
      let subtopic = `Page ${pageNumber} · Section ${passageIndex + 1}`;
      if (lower.includes('gradient') || lower.includes('optimizer') || lower.includes('loss')) {
        subtopic = 'Optimization & Loss Functions';
      } else if (lower.includes('attention') || lower.includes('transformer')) {
        subtopic = 'Attention Mechanisms & Transformers';
      }
      return {
        topic: 'Machine Learning Foundations',
        subtopic,
        keywords: ['machine-learning', 'deep-learning']
      };
    }

    // Unclassified fallback
    return {
      topic: 'Unclassified',
      subtopic: `Page ${pageNumber} · Section ${passageIndex + 1}`,
      keywords: ['unclassified', 'course-material']
    };
  }
}
