import importlib
import unittest
from types import SimpleNamespace
from unittest.mock import patch


class ConfigModelTests(unittest.TestCase):
    def test_defaults_ignore_legacy_model_env_vars(self):
        with patch.dict(
            "os.environ",
            {
                "OPENAI_MODEL": "legacy-all",
                "OPENAI_CHAT_MODEL": "legacy-chat",
                "OPENAI_GENERATION_MODEL": "legacy-generation",
            },
            clear=True,
        ):
            import app.config as config

            importlib.reload(config)

        self.assertEqual(config.settings.openai_weak_model, "gpt-5.4-mini")
        self.assertEqual(config.settings.openai_strong_model, "gpt-5.4")

    def test_explicit_weak_and_strong_models_are_used(self):
        with patch.dict(
            "os.environ",
            {
                "OPENAI_WEAK_MODEL": "weak-model",
                "OPENAI_STRONG_MODEL": "strong-model",
            },
            clear=True,
        ):
            import app.config as config

            importlib.reload(config)

        self.assertEqual(config.settings.openai_weak_model, "weak-model")
        self.assertEqual(config.settings.openai_strong_model, "strong-model")


class FakeResponses:
    def __init__(self, payload):
        self.payload = payload
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(output_text=self.payload)


class OpenAIResponseRoutingTests(unittest.TestCase):
    def test_chat_uses_weak_model_and_low_reasoning(self):
        import app.openai_client as openai_client

        fake_responses = FakeResponses('{"answer": "A", "used_ref_ids": []}')
        openai_client.client = SimpleNamespace(responses=fake_responses)
        openai_client.settings = SimpleNamespace(
            openai_weak_model="weak-model",
            openai_strong_model="strong-model",
            openai_embedding_model="embedding-model",
        )

        result = openai_client.generate_chat_response("What?", ["Context"])

        self.assertEqual(result["answer"], "A")
        self.assertEqual(fake_responses.calls[0]["model"], "weak-model")
        self.assertEqual(fake_responses.calls[0]["reasoning"], {"effort": "low"})

    def test_study_card_generation_uses_strong_model_and_medium_reasoning(self):
        import app.openai_client as openai_client

        fake_responses = FakeResponses('{"study_cards": []}')
        openai_client.client = SimpleNamespace(responses=fake_responses)
        openai_client.settings = SimpleNamespace(
            openai_weak_model="weak-model",
            openai_strong_model="strong-model",
            openai_embedding_model="embedding-model",
        )

        result = openai_client.generate_study_cards(
            module_title="Module",
            module_description=None,
            raw_text="Raw",
        )

        self.assertEqual(result, [])
        self.assertEqual(fake_responses.calls[0]["model"], "strong-model")
        self.assertEqual(fake_responses.calls[0]["reasoning"], {"effort": "medium"})

    def test_question_card_prompt_keeps_source_framing_hidden(self):
        import app.openai_client as openai_client

        fake_responses = FakeResponses('{"question_cards": []}')
        openai_client.client = SimpleNamespace(responses=fake_responses)
        openai_client.settings = SimpleNamespace(
            openai_weak_model="weak-model",
            openai_strong_model="strong-model",
            openai_embedding_model="embedding-model",
        )

        result = openai_client.generate_question_cards(
            study_cards=[
                {
                    "studyCardId": "card-1",
                    "title": "Example",
                    "content": "The service retries transient failures.",
                }
            ],
            existing_questions=[],
            difficulty="mixed",
        )

        self.assertEqual(result, [])
        messages = fake_responses.calls[0]["input"]
        system_prompt = messages[0]["content"]
        self.assertIn("Use the Study Cards only as hidden source material", system_prompt)
        self.assertIn("Do not mention 'study cards'", system_prompt)
        self.assertIn("Every question must still include study_card_refs", system_prompt)


if __name__ == "__main__":
    unittest.main()
