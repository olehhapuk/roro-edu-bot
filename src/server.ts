import express from 'express';
import 'dotenv/config';
import { db } from './db';
import { eq } from 'drizzle-orm';
import {
  hwSubmissionsTable,
  HwSubmissionStatus,
} from './db/schema/hw-submissions.table';

interface EventsData {
  onSendMessage: ((studentId: string, message: string) => void) | null;
  addOnSendMessageListener: (
    listener: (studentId: string, message: string) => void
  ) => void;
}

export const events: EventsData = {
  onSendMessage: null,
  addOnSendMessageListener(listener) {
    this.onSendMessage = listener;
  },
};

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.post('/', async (req, res) => {
  if (req.body.action && req.body.action === 'submitted') {
    const teacher = req.body.review.user.login;
    const submission = await db.query.hwSubmissions.findFirst({
      where: () =>
        eq(hwSubmissionsTable.githubPRLink, req.body.pull_request.html_url),
    });
    if (!submission) {
      return res.status(404).send('Submission not found');
    }

    if (req.body.review.state === 'approved') {
      console.log('test');
      await db
        .update(hwSubmissionsTable)
        .set({
          approvedAt: new Date(),
          rejectedAt: null,
          status: HwSubmissionStatus.APPROVED,
        })
        .where(eq(hwSubmissionsTable.id, submission.id));

      if (events.onSendMessage) {
        events.onSendMessage(
          submission.studentId,
          `Your homework submission PR ${req.body.pull_request.html_url} has been approved by ${teacher}.`
        );
      }
    } else if (req.body.review.state === 'changes_requested') {
      await db
        .update(hwSubmissionsTable)
        .set({
          rejectedAt: new Date(),
          approvedAt: null,
          status: HwSubmissionStatus.REJECTED,
        })
        .where(eq(hwSubmissionsTable.id, submission.id));
      if (events.onSendMessage) {
        events.onSendMessage(
          submission.studentId,
          `Your homework submission PR ${req.body.pull_request.html_url} has been rejected by ${teacher}.`
        );
      }
    }
  }

  return res.status(200).send('Webhook received');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
