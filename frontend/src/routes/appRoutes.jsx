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

const defaultRenderLegacyApp = () => null;

const page = (Component, renderLegacyApp) => (
  <Component renderLegacyApp={renderLegacyApp} />
);

const conceptChildren = (renderLegacyApp) => [
  {
    index: true,
    id: "concept-overview",
    element: page(ConceptOverviewPage, renderLegacyApp)
  },
  {
    path: "view-cards",
    id: "concept-view-cards",
    element: page(ConceptCardsPage, renderLegacyApp)
  },
  {
    path: "study-cards",
    id: "concept-study-cards",
    element: page(ConceptStudyCardsPage, renderLegacyApp)
  },
  {
    path: "question-cards",
    id: "concept-question-cards",
    element: page(ConceptQuestionCardsPage, renderLegacyApp)
  }
];

export function createAppRouteObjects(renderLegacyApp = defaultRenderLegacyApp) {
  return [
    {
      path: "/",
      id: "app-root",
      element: <AppRouteRootLayout />,
      children: [
        {
          index: true,
          id: "subject-index",
          element: page(SubjectIndexPage, renderLegacyApp)
        },
        {
          path: "app/subject/:subjectCode",
          id: "subject-layout",
          element: <SubjectLayout />,
          children: [
            {
              index: true,
              id: "subject-modules",
              element: page(SubjectModulesPage, renderLegacyApp)
            },
            {
              path: "module/:moduleCode",
              id: "module-layout",
              element: <ModuleLayout />,
              children: [
                {
                  index: true,
                  id: "module-overview",
                  element: page(ModuleOverviewPage, renderLegacyApp)
                },
                {
                  path: "mind-map",
                  id: "module-mind-map",
                  element: page(ModuleMindMapPage, renderLegacyApp)
                },
                {
                  path: "create-note-group",
                  id: "note-group-create",
                  element: page(NoteGroupCreatePage, renderLegacyApp)
                },
                {
                  path: "note-groups/:noteGroupCode",
                  id: "note-group-layout",
                  element: <NoteGroupLayout />,
                  children: [
                    {
                      index: true,
                      id: "note-group-overview",
                      element: page(NoteGroupOverviewPage, renderLegacyApp)
                    },
                    {
                      path: "mind-map",
                      id: "note-group-mind-map",
                      element: page(NoteGroupMindMapPage, renderLegacyApp)
                    },
                    {
                      path: "view-cards",
                      id: "note-group-view-cards",
                      element: page(NoteGroupCardsPage, renderLegacyApp)
                    },
                    {
                      path: "study-cards",
                      id: "note-group-study-cards",
                      element: page(NoteGroupStudyCardsPage, renderLegacyApp)
                    },
                    {
                      path: "question-cards",
                      id: "note-group-question-cards",
                      element: page(NoteGroupQuestionCardsPage, renderLegacyApp)
                    }
                  ]
                },
                {
                  path: "concepts/:conceptCode",
                  id: "concept-layout",
                  element: <ConceptLayout />,
                  children: conceptChildren(renderLegacyApp)
                },
                {
                  path: "topics/:conceptCode",
                  id: "legacy-topic-layout",
                  element: <ConceptLayout />,
                  children: conceptChildren(renderLegacyApp)
                }
              ]
            }
          ]
        },
        {
          path: "*",
          id: "fallback",
          element: page(SubjectIndexPage, renderLegacyApp)
        }
      ]
    }
  ];
}

export function AppRoutes({ renderLegacyApp = defaultRenderLegacyApp }) {
  return useRoutes(createAppRouteObjects(renderLegacyApp));
}
