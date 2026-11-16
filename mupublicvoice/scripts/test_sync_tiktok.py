import unittest
from sync_tiktok import extract_vote, aggregate, public_result


class VoteParsingTests(unittest.TestCase):
    def test_simple_votes(self):
        for letter in "ABCD":
            self.assertEqual(extract_vote(letter), letter)
            self.assertEqual(extract_vote(letter.lower() + "."), letter)
        self.assertEqual(extract_vote("I vote A"), "A")
        self.assertEqual(extract_vote("I choose B"), "B")
        self.assertEqual(extract_vote("my vote is c"), "C")

    def test_reject_ambiguous(self):
        for value in ("A or B", "I vote A and B", "Thank you", "ABC", "D for doctors", ""):
            self.assertIsNone(extract_vote(value))

    def test_dedup_owner_visibility_and_earliest(self):
        rows = [
            {"unique_identifier": "u1", "comment_id": "2", "create_time": "200", "text": "B", "status": "PUBLIC", "owner": False},
            {"unique_identifier": "u1", "comment_id": "1", "create_time": "100", "text": "A", "status": "PUBLIC", "owner": False},
            {"unique_identifier": "u1", "comment_id": "1", "create_time": "100", "text": "A", "status": "PUBLIC", "owner": False},
            {"unique_identifier": "u2", "comment_id": "3", "create_time": "150", "text": "C", "status": "HIDDEN", "owner": False},
            {"unique_identifier": "u3", "comment_id": "4", "create_time": "150", "text": "D", "status": "PUBLIC", "owner": True},
            {"unique_identifier": "u4", "comment_id": "5", "create_time": "150", "text": "C", "status": "PUBLIC", "owner": False},
            {"username": "missing-stable-id", "comment_id": "6", "create_time": "150", "text": "D", "status": "PUBLIC", "owner": False},
        ]
        expected = {"A": 1, "B": 0, "C": 1, "D": 0}
        self.assertEqual(aggregate(rows), expected)
        self.assertEqual(aggregate(list(reversed(rows))), expected)
        self.assertEqual(aggregate(rows + rows), expected)

    def test_public_output_has_no_user_ids(self):
        data = public_result({"A": 1, "B": 1, "C": 0, "D": 0}, "1234567890123456789")
        self.assertEqual(data["total"], 2)
        self.assertNotIn("comments", data)
        self.assertNotIn("voters", data)
        self.assertEqual(data["percentages"]["A"], 50.0)


if __name__ == "__main__":
    unittest.main()
