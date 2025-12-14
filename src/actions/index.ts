// Survey Mutations (Server Actions)
export {
  createSurvey,
  updateSurvey,
  deleteSurvey,
  duplicateSurvey,
  createQuestionGroup,
  updateQuestionGroup,
  deleteQuestionGroup,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  saveSurveyWithDetails,
} from './survey-actions';

// Response Mutations (Server Actions)
export {
  startResponse,
  updateQuestionResponse,
  completeResponse,
  deleteResponse,
  importResponses,
  clearSurveyResponses,
  clearAllResponses,
} from './response-actions';

// Library Mutations (Server Actions)
export {
  saveQuestion,
  updateSavedQuestion,
  deleteSavedQuestion,
  applyQuestion,
  applyMultipleQuestions,
  exportLibrary,
  importLibrary,
  createCategory,
  updateCategory,
  deleteCategory,
  initializeDefaultCategories,
  initializePresetQuestions,
} from './library-actions';

// Auth Actions
export {
  login,
  logout,
  updatePassword,
  getUser,
} from './auth-actions';

// Query Actions (for client-side TanStack Query)
export {
  getSurveys,
  getSurveyById,
  getSurveyBySlug,
  getSurveyByPrivateToken,
  isSlugAvailable,
  searchSurveys,
  getSurveysByDateRange,
  getQuestionGroupsBySurvey,
  getQuestionsBySurvey,
  getSurveyWithDetails,
  getSurveyListWithCounts,
  getResponsesBySurvey,
  getCompletedResponses,
  getResponseById,
  getResponseCountBySurvey,
  getCompletedResponseCountBySurvey,
  calculateResponseSummary,
  getQuestionStatistics,
  exportResponsesAsJson,
  exportResponsesAsCsv,
  getAllSavedQuestions,
  getQuestionsByCategory,
  searchSavedQuestions,
  getRecentlyUsedQuestions,
  getMostUsedQuestions,
  getAllTags,
  getQuestionsByTag,
  getAllCategories,
} from './query-actions';
