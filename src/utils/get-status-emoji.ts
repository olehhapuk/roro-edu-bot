import { HwSubmissionStatus } from '../db/schema/hw-submissions.table';

export function getStatusEmoji(status: HwSubmissionStatus) {
  switch (status) {
    case HwSubmissionStatus.PENDING:
      return '⏳';
    case HwSubmissionStatus.APPROVED:
      return '✅';
    case HwSubmissionStatus.REJECTED:
      return '❌';
    default:
      return '';
  }
}
