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
  ConceptOverviewPage,
  ConceptQuestionCardsPage,
  ConceptStudyCardsPage,
  ModuleMindMapPage,
  ModuleOverviewPage,
  NoteGroupCardsPage,
  NoteGroupCreatePage,
  NoteGroupMindMapPage,
  NoteGroupOverviewPage,
  NoteGroupQuestionCardsPage,
  NoteGroupStudyCardsPage,
  SubjectIndexPage,
  SubjectModulesPage
} from "./pages";

const defaultRenderAppShell = () => null;

const page = (Component, renderAppShell) => (
  <Component renderAppShell={renderAppShell} />
);

const conceptChildren = (renderAppShell) => [
  {
    index: true,
    id: "concept-overview",
    element: page(ConceptOverviewPage, renderAppShell)
  },
  {
    path: "view-cards",
    id: "concept-view-cards",
    element: page(ConceptCardsPage, renderAppShell)
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
      id: "app-root",
      element: <AppRouteRootLayout />,
      children: [
        {
          index: true,
          id: "subject-index",
          element: page(SubjectIndexPage, renderAppShell)
        },
        {
          path: "app/subject/:subjectCode",
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
                  id: "module-overview",
                  element: page(ModuleOverviewPage, renderAppShell)
                },
                {
                  path: "mind-map",
                  id: "module-mind-map",
                  element: page(ModuleMindMapPage, renderAppShell)
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
                      id: "note-group-overview",
                      element: page(NoteGroupOverviewPage, renderAppShell)
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
          id: "fallback",
          element: page(SubjectIndexPage, renderAppShell)
        }
      ]
    }
  ];
}

export function AppRoutes({ renderAppShell = defaultRenderAppShell }) {
  return useRoutes(createAppRouteObjects(renderAppShell));
}
