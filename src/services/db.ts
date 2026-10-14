import {
  Chunk,
  Course,
  DocumentSource,
  EvaluationRunSummary,
  QuizSession,
  RevisionTask,
  TopicMastery,
  TutorMessage
} from '../types';
import {
  SAMPLE_COURSE,
  SAMPLE_DOCUMENTS,
  CS302_LINUX_COURSE,
  LINUX_CA1_DOCUMENT,
  PROBLEM_STATEMENTS_DOCUMENT
} from '../data/sampleCourse';
import { learnerEngine } from './learnerModel';
import { TextValidator } from './textValidator';

const DB_NAME = 'studypilot_ai_db';
const DB_VERSION = 1;

export interface AppStateExport {
  courses: Course[];
  documents: DocumentSource[];
  masteryRecords: Record<string, TopicMastery>;
  quizSessions: QuizSession[];
  tutorMessages: TutorMessage[];
  revisionTasks: RevisionTask[];
  evaluationRuns: EvaluationRunSummary[];
  exportedAt: string;
}

class AppStorage {
  private dbPromise: Promise<IDBDatabase | null>;
  private memoryStore = new Map<string, string>();

  constructor() {
    this.dbPromise = this.initIndexedDB();
  }

  private getLocal(key: string): string | null {
    if (typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem(key);
      } catch (_) {}
    }
    return this.memoryStore.get(key) || null;
  }

  private setLocal(key: string, value: string): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, value);
      } catch (_) {}
    }
    this.memoryStore.set(key, value);
  }

  private removeLocal(key: string): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch (_) {}
    }
    this.memoryStore.delete(key);
  }

  private clearLocal(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.clear();
      } catch (_) {}
    }
    this.memoryStore.clear();
  }

  private initIndexedDB(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('courses')) db.createObjectStore('courses', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('documents')) db.createObjectStore('documents', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('mastery')) db.createObjectStore('mastery', { keyPath: 'topicId' });
        if (!db.objectStoreNames.contains('quizzes')) db.createObjectStore('quizzes', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('tutor')) db.createObjectStore('tutor', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('revision')) db.createObjectStore('revision', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('evaluations')) db.createObjectStore('evaluations', { keyPath: 'id' });
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('IndexedDB unavailable, falling back to localStorage');
        resolve(null);
      };
    });
  }

  // --- Courses ---
  public async getCourses(): Promise<Course[]> {
    const defaultCourses = [SAMPLE_COURSE, CS302_LINUX_COURSE];
    const db = await this.dbPromise;
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction('courses', 'readonly');
        const store = tx.objectStore('courses');
        const req = store.getAll();
        req.onsuccess = () => {
          if (req.result && req.result.length > 0) {
            // Ensure Linux course is present
            const exists = req.result.some((c: Course) => c.id === CS302_LINUX_COURSE.id);
            if (!exists) {
              this.saveCourse(CS302_LINUX_COURSE);
              resolve([...req.result, CS302_LINUX_COURSE]);
            } else {
              resolve(req.result);
            }
          } else {
            resolve(defaultCourses);
          }
        };
        req.onerror = () => resolve(defaultCourses);
      });
    }
    const local = this.getLocal('sp_courses');
    if (!local) return defaultCourses;
    const parsed: Course[] = JSON.parse(local);
    if (!parsed.some(c => c.id === CS302_LINUX_COURSE.id)) {
      parsed.push(CS302_LINUX_COURSE);
      this.setLocal('sp_courses', JSON.stringify(parsed));
    }
    return parsed;
  }

  public async saveCourse(course: Course): Promise<void> {
    const db = await this.dbPromise;
    if (db) {
      const tx = db.transaction('courses', 'readwrite');
      tx.objectStore('courses').put(course);
    }
    const current = await this.getCourses();
    const filtered = current.filter(c => c.id !== course.id);
    this.setLocal('sp_courses', JSON.stringify([...filtered, course]));
  }

  // --- Documents ---
  public async getDocuments(): Promise<DocumentSource[]> {
    const defaultDocs = [...SAMPLE_DOCUMENTS, LINUX_CA1_DOCUMENT, PROBLEM_STATEMENTS_DOCUMENT];
    let docs: DocumentSource[];
    const db = await this.dbPromise;
    if (db) {
      docs = await new Promise((resolve) => {
        const tx = db.transaction('documents', 'readonly');
        const store = tx.objectStore('documents');
        const req = store.getAll();
        req.onsuccess = () => {
          if (req.result && req.result.length > 0) resolve(req.result);
          else resolve(defaultDocs);
        };
        req.onerror = () => resolve(defaultDocs);
      });
    } else {
      const local = this.getLocal('sp_documents');
      docs = local ? JSON.parse(local) : defaultDocs;
    }

    // Cleanse any corrupted chunks and heal any misclassified documents
    const sanitizedDocs: DocumentSource[] = [];
    let hadCorrupted = false;

    for (const doc of docs) {
      // 1. Repair Problem Statements.pdf if it was misclassified under Machine Learning or Optimization & Loss Functions
      if (doc.title.toLowerCase().includes('problem statements')) {
        const isMisclassified =
          doc.topic === 'Optimization & Loss Functions' ||
          doc.chunks.some(c => c.topic === 'Optimization & Loss Functions' || c.topic.includes('Optimization'));

        if (isMisclassified || doc.chunks.length !== 4) {
          hadCorrupted = true;
          sanitizedDocs.push({
            ...PROBLEM_STATEMENTS_DOCUMENT,
            id: doc.id,
            courseId: doc.courseId
          });
          continue;
        }
      }

      // Check chunks for corruption
      const validChunks = doc.chunks.filter(c => {
        const check = TextValidator.validateReadability(c.text);
        return check.isReadable || c.text.startsWith('[Page');
      });

      if (validChunks.length !== doc.chunks.length) {
        hadCorrupted = true;
      }

      // If document is CA1.pdf and had corrupted chunks or no readable chunks, replace with clean verified LINUX_CA1_DOCUMENT
      if (doc.title.toLowerCase().includes('ca1') && validChunks.length === 0) {
        hadCorrupted = true;
        sanitizedDocs.push(LINUX_CA1_DOCUMENT);
        continue;
      }

      if (validChunks.length > 0) {
        // Deduplicate chunks inside each document by chunk ID
        const chunkMap = new Map<string, Chunk>();
        validChunks.forEach(c => {
          if (!chunkMap.has(c.id)) {
            chunkMap.set(c.id, c);
          }
        });
        const deduplicatedChunks = Array.from(chunkMap.values());

        sanitizedDocs.push({
          ...doc,
          chunks: deduplicatedChunks,
          totalChunks: deduplicatedChunks.length
        });
      }
    }

    // Ensure LINUX_CA1_DOCUMENT is present for CS-302
    if (!sanitizedDocs.some(d => d.id === LINUX_CA1_DOCUMENT.id || d.title.toLowerCase().includes('ca1'))) {
      sanitizedDocs.push(LINUX_CA1_DOCUMENT);
      hadCorrupted = true;
    }

    // Ensure PROBLEM_STATEMENTS_DOCUMENT is present
    if (!sanitizedDocs.some(d => d.id === PROBLEM_STATEMENTS_DOCUMENT.id || d.title.toLowerCase().includes('problem statements'))) {
      sanitizedDocs.push(PROBLEM_STATEMENTS_DOCUMENT);
      hadCorrupted = true;
    }

    // Strictly deduplicate documents by ID and Title
    const deduplicatedDocsMap = new Map<string, DocumentSource>();
    for (const doc of sanitizedDocs) {
      if (!deduplicatedDocsMap.has(doc.id)) {
        deduplicatedDocsMap.set(doc.id, doc);
      }
    }
    const finalDocs = Array.from(deduplicatedDocsMap.values());

    if (hadCorrupted || finalDocs.length !== sanitizedDocs.length) {
      // Resync storage without corrupted chunks or stale classifications
      this.setLocal('sp_documents', JSON.stringify(finalDocs));
      if (db) {
        try {
          const tx = db.transaction('documents', 'readwrite');
          const store = tx.objectStore('documents');
          store.clear();
          finalDocs.forEach(d => store.put(d));
        } catch (_) {}
      }
    }

    return finalDocs.length > 0 ? finalDocs : defaultDocs;
  }

  public async purgeCorruptedChunks(): Promise<{ purgedDocsCount: number; purgedChunksCount: number }> {
    const docs = await this.getDocuments();
    let purgedChunks = 0;
    let purgedDocs = 0;

    const cleaned: DocumentSource[] = [];
    for (const doc of docs) {
      const initialChunkCount = doc.chunks.length;
      const cleanChunks = doc.chunks.filter(c => TextValidator.validateReadability(c.text).isReadable || c.text.startsWith('[Page'));
      purgedChunks += (initialChunkCount - cleanChunks.length);

      if (doc.title.toLowerCase().includes('ca1') && cleanChunks.length === 0) {
        purgedDocs++;
        continue;
      }

      if (cleanChunks.length > 0) {
        cleaned.push({
          ...doc,
          chunks: cleanChunks,
          totalChunks: cleanChunks.length
        });
      } else {
        purgedDocs++;
      }
    }

    this.setLocal('sp_documents', JSON.stringify(cleaned));
    return { purgedDocsCount: purgedDocs, purgedChunksCount: purgedChunks };
  }

  public async saveDocument(doc: DocumentSource): Promise<void> {
    // Validate all chunks before saving
    const validChunks = doc.chunks.filter(c => {
      const check = TextValidator.validateReadability(c.text);
      return check.isReadable || c.text.startsWith('[Page');
    });

    // Deduplicate chunks inside document
    const chunkMap = new Map<string, Chunk>();
    validChunks.forEach(c => {
      if (!chunkMap.has(c.id)) {
        chunkMap.set(c.id, c);
      }
    });

    const sanitizedDoc: DocumentSource = {
      ...doc,
      chunks: Array.from(chunkMap.values()),
      totalChunks: chunkMap.size
    };

    const db = await this.dbPromise;
    if (db) {
      const tx = db.transaction('documents', 'readwrite');
      tx.objectStore('documents').put(sanitizedDoc);
    }
    const current = await this.getDocuments();
    const filtered = current.filter(d => d.id !== doc.id && !(d.courseId === doc.courseId && d.title.toLowerCase() === doc.title.toLowerCase()));
    this.setLocal('sp_documents', JSON.stringify([...filtered, sanitizedDoc]));
  }

  public async deleteDocument(docId: string): Promise<void> {
    const db = await this.dbPromise;
    if (db) {
      const tx = db.transaction('documents', 'readwrite');
      tx.objectStore('documents').delete(docId);
    }
    const current = await this.getDocuments();
    this.setLocal('sp_documents', JSON.stringify(current.filter(d => d.id !== docId)));
  }

  // --- Mastery (BKT) ---
  public async getMasteryRecords(): Promise<Record<string, TopicMastery>> {
    const db = await this.dbPromise;
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction('mastery', 'readonly');
        const store = tx.objectStore('mastery');
        const req = store.getAll();
        req.onsuccess = () => {
          if (req.result && req.result.length > 0) {
            const map: Record<string, TopicMastery> = {};
            req.result.forEach((m: TopicMastery) => { map[m.topicId] = m; });
            resolve(map);
          } else {
            const defaults = learnerEngine.initializeTopicRecords(
              SAMPLE_COURSE.topics.map(t => ({ id: t.id, title: t.title })),
              0.35
            );
            resolve(defaults);
          }
        };
        req.onerror = () => {
          resolve(learnerEngine.initializeTopicRecords(SAMPLE_COURSE.topics, 0.35));
        };
      });
    }
    const local = this.getLocal('sp_mastery');
    if (local) return JSON.parse(local);
    return learnerEngine.initializeTopicRecords(SAMPLE_COURSE.topics, 0.35);
  }

  public async saveMasteryRecord(record: TopicMastery): Promise<void> {
    const db = await this.dbPromise;
    if (db) {
      const tx = db.transaction('mastery', 'readwrite');
      tx.objectStore('mastery').put(record);
    }
    const current = await this.getMasteryRecords();
    current[record.topicId] = record;
    this.setLocal('sp_mastery', JSON.stringify(current));
  }

  // --- Quizzes ---
  public async getQuizSessions(): Promise<QuizSession[]> {
    const db = await this.dbPromise;
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction('quizzes', 'readonly');
        const req = tx.objectStore('quizzes').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    }
    const local = this.getLocal('sp_quizzes');
    return local ? JSON.parse(local) : [];
  }

  public async saveQuizSession(session: QuizSession): Promise<void> {
    const db = await this.dbPromise;
    if (db) {
      const tx = db.transaction('quizzes', 'readwrite');
      tx.objectStore('quizzes').put(session);
    }
    const current = await this.getQuizSessions();
    const filtered = current.filter(q => q.id !== session.id);
    this.setLocal('sp_quizzes', JSON.stringify([session, ...filtered]));
  }

  // --- Tutor Messages ---
  public async getTutorMessages(): Promise<TutorMessage[]> {
    const db = await this.dbPromise;
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction('tutor', 'readonly');
        const req = tx.objectStore('tutor').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    }
    const local = this.getLocal('sp_tutor');
    return local ? JSON.parse(local) : [];
  }

  public async saveTutorMessage(msg: TutorMessage): Promise<void> {
    const db = await this.dbPromise;
    if (db) {
      const tx = db.transaction('tutor', 'readwrite');
      tx.objectStore('tutor').put(msg);
    }
    const current = await this.getTutorMessages();
    this.setLocal('sp_tutor', JSON.stringify([...current, msg]));
  }

  public async clearTutorMessages(): Promise<void> {
    const db = await this.dbPromise;
    if (db) {
      const tx = db.transaction('tutor', 'readwrite');
      tx.objectStore('tutor').clear();
    }
    this.removeLocal('sp_tutor');
  }

  // --- Revision Tasks ---
  public async getRevisionTasks(): Promise<RevisionTask[]> {
    const db = await this.dbPromise;
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction('revision', 'readonly');
        const req = tx.objectStore('revision').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    }
    const local = this.getLocal('sp_revision');
    return local ? JSON.parse(local) : [];
  }

  public async saveRevisionTask(task: RevisionTask): Promise<void> {
    const db = await this.dbPromise;
    if (db) {
      const tx = db.transaction('revision', 'readwrite');
      tx.objectStore('revision').put(task);
    }
    const current = await this.getRevisionTasks();
    const filtered = current.filter(t => t.id !== task.id);
    this.setLocal('sp_revision', JSON.stringify([...filtered, task]));
  }

  public async deleteRevisionTask(taskId: string): Promise<void> {
    const db = await this.dbPromise;
    if (db) {
      const tx = db.transaction('revision', 'readwrite');
      tx.objectStore('revision').delete(taskId);
    }
    const current = await this.getRevisionTasks();
    this.setLocal('sp_revision', JSON.stringify(current.filter(t => t.id !== taskId)));
  }

  // --- Evaluation Runs ---
  public async getEvaluationRuns(): Promise<EvaluationRunSummary[]> {
    const db = await this.dbPromise;
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction('evaluations', 'readonly');
        const req = tx.objectStore('evaluations').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    }
    const local = this.getLocal('sp_evaluations');
    return local ? JSON.parse(local) : [];
  }

  public async saveEvaluationRun(summary: EvaluationRunSummary): Promise<void> {
    const db = await this.dbPromise;
    if (db) {
      const tx = db.transaction('evaluations', 'readwrite');
      tx.objectStore('evaluations').put(summary);
    }
    const current = await this.getEvaluationRuns();
    const filtered = current.filter(e => e.id !== summary.id);
    this.setLocal('sp_evaluations', JSON.stringify([summary, ...filtered]));
  }

  // --- Backup & Reset ---
  public async exportAll(): Promise<AppStateExport> {
    const [courses, documents, masteryRecords, quizSessions, tutorMessages, revisionTasks, evaluationRuns] = await Promise.all([
      this.getCourses(),
      this.getDocuments(),
      this.getMasteryRecords(),
      this.getQuizSessions(),
      this.getTutorMessages(),
      this.getRevisionTasks(),
      this.getEvaluationRuns()
    ]);

    return {
      courses,
      documents,
      masteryRecords,
      quizSessions,
      tutorMessages,
      revisionTasks,
      evaluationRuns,
      exportedAt: new Date().toISOString()
    };
  }

  public async importAll(data: Partial<AppStateExport>): Promise<void> {
    if (data.courses) this.setLocal('sp_courses', JSON.stringify(data.courses));
    if (data.documents) this.setLocal('sp_documents', JSON.stringify(data.documents));
    if (data.masteryRecords) this.setLocal('sp_mastery', JSON.stringify(data.masteryRecords));
    if (data.quizSessions) this.setLocal('sp_quizzes', JSON.stringify(data.quizSessions));
    if (data.tutorMessages) this.setLocal('sp_tutor', JSON.stringify(data.tutorMessages));
    if (data.revisionTasks) this.setLocal('sp_revision', JSON.stringify(data.revisionTasks));
    if (data.evaluationRuns) this.setLocal('sp_evaluations', JSON.stringify(data.evaluationRuns));

    // Clear and resync IDB if present
    const db = await this.dbPromise;
    if (db) {
      const stores = ['courses', 'documents', 'mastery', 'quizzes', 'tutor', 'revision', 'evaluations'];
      stores.forEach(s => {
        try {
          const tx = db.transaction(s, 'readwrite');
          tx.objectStore(s).clear();
        } catch (_) {}
      });
    }
  }

  public async resetToSampleCourse(): Promise<void> {
    this.clearLocal();
    const db = await this.dbPromise;
    if (db) {
      const stores = ['courses', 'documents', 'mastery', 'quizzes', 'tutor', 'revision', 'evaluations'];
      stores.forEach(s => {
        try {
          const tx = db.transaction(s, 'readwrite');
          tx.objectStore(s).clear();
        } catch (_) {}
      });
    }
  }
}

export const appDb = new AppStorage();
