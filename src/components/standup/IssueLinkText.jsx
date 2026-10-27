import React from "react";
import { Link } from "react-router-dom";

const ISSUE_NUM_REGEX = /AEE-\d{4}/gi;

export default function IssueLinkText({ text, issues = [] }) {
  if (!text) return null;

  const issueMap = {};
  for (const iss of issues) {
    if (iss.issue_number) issueMap[iss.issue_number.toLowerCase()] = iss.id;
  }

  const parts = [];
  let lastIndex = 0;
  let match;
  const regex = new RegExp(ISSUE_NUM_REGEX.source, "gi");
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const issueNum = match[0];
    const issueId = issueMap[issueNum.toLowerCase()];
    if (issueId) {
      parts.push(
        <Link
          key={`link-${key++}`}
          to={`/IssueDetail?id=${issueId}`}
          style={{ color: "#2563EB", fontWeight: 700, textDecoration: "underline", cursor: "pointer" }}
          onClick={(e) => e.stopPropagation()}
        >
          {issueNum}
        </Link>
      );
    } else {
      parts.push(<span key={`num-${key++}`} style={{ fontWeight: 700, color: "#101C34" }}>{issueNum}</span>);
    }
    lastIndex = match.index + issueNum.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}