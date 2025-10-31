import { classroomsTable } from './classrooms.table';
import { homeworksTable } from './homeworks.table';
import {
  hwSubmissionsRelations,
  hwSubmissionsTable,
  hwSubmissionStatusEnum,
} from './hw-submissions.table';

export const schema = {
  classrooms: classroomsTable,
  homeworks: homeworksTable,
  hwSubmissions: hwSubmissionsTable,
  hwSubmissionStatusEnum,
  hwSubmissionsRelations,
};
