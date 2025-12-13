// Simplified queue without Redis/Bull
// For now, imports will be synchronous

class SimpleQueue {
  constructor() {
    this.jobs = new Map();
    this.jobCounter = 0;
  }

  async add(name, data) {
    const jobId = ++this.jobCounter;
    this.jobs.set(jobId, {
      id: jobId,
      name,
      data,
      state: "pending",
      progress: 0,
      result: null,
    });
    return { id: jobId };
  }

  async getJob(jobId) {
    return this.jobs.get(parseInt(jobId));
  }

  updateJob(jobId, updates) {
    const job = this.jobs.get(parseInt(jobId));
    if (job) {
      Object.assign(job, updates);
    }
  }
}

export const importQueue = new SimpleQueue();