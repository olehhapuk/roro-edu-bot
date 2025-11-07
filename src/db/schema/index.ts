import { classroomsTable } from './classrooms.table';
import { homeworksRelations, homeworksTable } from './homeworks.table';
import {
  hwSubmissionsRelations,
  hwSubmissionsTable,
  hwSubmissionStatusEnum,
} from './hw-submissions.table';
import { lessonReportsTable } from './lesson-reports.table';

export const schema = {
  classrooms: classroomsTable,
  homeworks: homeworksTable,
  hwSubmissions: hwSubmissionsTable,
  hwSubmissionStatusEnum,
  hwSubmissionsRelations,
  lessonReports: lessonReportsTable,
  homeworksRelations,
};
