import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchUtilajSerial } from "@/components/issues/picklists";

const ISSUE_NUM_REGEX = /AEE-\d{4}/gi;

export default function UtilajeLinkText({ text, issues = [] }) {
  const [utilajSerials, setUtilajSerials] = useState([]);

  useEffect(() => {
    fetchUtilajSerial().then(setUtilajSerials).catch(() => {});
  }, []);

  if (!text) return null;

  const utilajSerialValues = new Set(utilajSerials.map((s) => s.partNumber));
  const issueMap = {};
  for (const iss of issues) {
    if (iss.issue_number) issueMap[iss.issue_number.toLowerCase()] = iss;
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
    const issue = issueMap[issueNum.toLowerCase()];
    const isLinked = issue && issue.part_number && utilajSerialValues.has(issue.part_number);
    if (isLinked) {
      parts.push(
        <Link
          key={`link-${key++}`}
          to={`/IssueDetail?id=${issue.id}`}
          style={{ color: "#2563EB", fontWeight: 700, textDecoration: "underline", cursor: "pointer" }}
          onClick={(e) => e.stopPropagation()}
        >
          {issueNum}
        </Link>
      );
      if (issue.part_number) parts.push(` / ${issue.part_number}`);
      if (issue.defect_description) parts.push(` / ${issue.defect_description}`);
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