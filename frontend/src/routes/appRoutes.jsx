import React from "react";
import { useRoutes } from "react-router-dom";

import {
  AppRouteRootLayout,
  ConceptLayout,
  ModuleLayout,
  NoteGroupLayout,
  SubjectLayout
} from "./layouts";
import {
  ConceptCardsPage,
  ConceptQuestionCardsPage,
  ConceptStudyCardsPage,
  ConceptMindMapPage,
  ForgotPasswordRoutePage,
  LoginLandingRoutePage,
  ModuleCardsPage,
  ModuleMindMapPage,
  ModuleStudyPage,
  NoteGroupCardsPage,
  NoteGroupCreatePage,
  NoteGroupMindMapPage,
  NoteGroupStudyPage,
  NoteGroupQuestionCardsPage,
  NoteGroupStudyCardsPage,
  RegisterRoutePage,
  SubjectIndexPage,
  SubjectModulesPage,
  UpdatePasswordRoutePage
} from "./pages";

const defaultRenderAppShell = () => null;

const page = (Component, renderAppShell) => (
  <Component renderAppShell={renderAppShell} />
);

const conceptChildren = (renderAppShell) => [
  {
    index: true,
    id: "concept-default-mind-map",
    element: page(ConceptMindMapPage, renderAppShell)
  },
  {
    path: "mind-map",
    id: "concept-mind-map",
    element: page(ConceptMindMapPage, renderAppShell)
  },
  {
    path: "view-cards",
    id: "concept-view-cards",
    element: page(ConceptCardsPage, renderAppShell)
  },
  {
    path: "study",
    id: "concept-study",
    element: page(ConceptStudyCardsPage, renderAppShell)
  },
  {
    path: "study-cards",
    id: "concept-study-cards",
    element: page(ConceptStudyCardsPage, renderAppShell)
  },
  {
    path: "question-cards",
    id: "concept-question-cards",
    element: page(ConceptQuestionCardsPage, renderAppShell)
  }
];

export function createAppRouteObjects(renderAppShell = defaultRenderAppShell) {
  return [
    {
      path: "/",
      children: [
        {
          index: true,
          id: "login-landing",
          element: <LoginLandingRoutePage />
        },
        {
          path: "register",
          id: "register",
          element: <RegisterRoutePage />
        },
        {
          path: "forgot-password",
          id: "forgot-password",
          element: <ForgotPasswordRoutePage />
        },
        {
          path: "account/update-password",
          id: "update-password",
          element: <UpdatePasswordRoutePage />
        },
        {
          path: "*",
          id: "fallback",
          element: <LoginLandingRoutePage />
        }
      ]
    },
    {
      path: "/app",
      id: "app-root",
      element: <AppRouteRootLayout />,
      children: [
        {
          index: true,
          id: "subject-index",
          element: page(SubjectIndexPage, renderAppShell)
        },
        {
          path: "subject/:subjectCode",
          id: "subject-layout",
          element: <SubjectLayout />,
          children: [
            {
              index: true,
              id: "subject-modules",
              element: page(SubjectModulesPage, renderAppShell)
            },
            {
              path: "module/:moduleCode",
              id: "module-layout",
              element: <ModuleLayout renderAppShell={renderAppShell} />,
              children: [
                {
                  index: true,
                  id: "module-default-mind-map",
                  element: page(ModuleMindMapPage, renderAppShell)
                },
                {
                  path: "mind-map",
                  id: "module-mind-map",
                  element: page(ModuleMindMapPage, renderAppShell)
                },
                {
                  path: "view-cards",
                  id: "module-view-cards",
                  element: page(ModuleCardsPage, renderAppShell)
                },
                {
                  path: "study",
                  id: "module-study",
                  element: page(ModuleStudyPage, renderAppShell)
                },
                {
                  path: "create-note-group",
                  id: "note-group-create",
                  element: page(NoteGroupCreatePage, renderAppShell)
                },
                {
                  path: "note-groups/:noteGroupCode",
                  id: "note-group-layout",
                  element: <NoteGroupLayout />,
                  children: [
                    {
                      index: true,
                      id: "note-group-default-mind-map",
                      element: page(NoteGroupMindMapPage, renderAppShell)
                    },
                    {
                      path: "mind-map",
                      id: "note-group-mind-map",
                      element: page(NoteGroupMindMapPage, renderAppShell)
                    },
                    {
                      path: "view-cards",
                      id: "note-group-view-cards",
                      element: page(NoteGroupCardsPage, renderAppShell)
                    },
                    {
                      path: "study",
                      id: "note-group-study",
                      element: page(NoteGroupStudyPage, renderAppShell)
                    },
                    {
                      path: "study-cards",
                      id: "note-group-study-cards",
                      element: page(NoteGroupStudyCardsPage, renderAppShell)
                    },
                    {
                      path: "question-cards",
                      id: "note-group-question-cards",
                      element: page(NoteGroupQuestionCardsPage, renderAppShell)
                    }
                  ]
                },
                {
                  path: "concepts/:conceptCode",
                  id: "concept-layout",
                  element: <ConceptLayout />,
                  children: conceptChildren(renderAppShell)
                },
                {
                  path: "topics/:conceptCode",
                  id: "legacy-topic-layout",
                  element: <ConceptLayout />,
                  children: conceptChildren(renderAppShell)
                }
              ]
            }
          ]
        },
        {
          path: "*",
          id: "app-fallback",
          element: page(SubjectIndexPage, renderAppShell)
        }
      ]
    }
  ];
}

export function AppRoutes({ renderAppShell = defaultRenderAppShell }) {
  return useRoutes(createAppRouteObjects(renderAppShell));
}
