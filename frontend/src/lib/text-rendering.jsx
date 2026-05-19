import React from "react";

export const renderInlineText = (text) => {
  const segments = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;
  let keyIndex = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(text.slice(lastIndex, match.index));
    }
    segments.push(<strong key={`strong-${keyIndex}`}>{match[1]}</strong>);
    keyIndex += 1;
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex));
  }
  return segments;
};

export const renderMarkdownBlocks = (content) => {
  if (!content) {
    return null;
  }
  const elements = [];
  const lines = content.split("\n");
  let paragraphLines = [];
  let listItems = [];
  let blockIndex = 0;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }
    const text = paragraphLines.join(" ").trim();
    elements.push(<p key={`paragraph-${blockIndex}`}>{renderInlineText(text)}</p>);
    blockIndex += 1;
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }
    elements.push(
      <ul key={`list-${blockIndex}`}>
        {listItems.map((item, index) => (
          <li key={`list-item-${blockIndex}-${index}`}>{renderInlineText(item)}</li>
        ))}
      </ul>
    );
    blockIndex += 1;
    listItems = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }
    if (trimmed.startsWith("- ")) {
      flushParagraph();
      listItems.push(trimmed.slice(2).trim());
      return;
    }
    flushList();
    paragraphLines.push(trimmed);
  });

  flushParagraph();
  flushList();
  return elements;
};

export const getOverlappingHighlights = (start, end, highlights) =>
  highlights.filter((highlight) => start < highlight.end_index && end > highlight.start_index);

export const renderInlineMarkdown = (text, keyPrefix) => {
  const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${keyPrefix}-b${i}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={`${keyPrefix}-e${i}`}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
};

export const renderHighlightedText = (text, baseIndex, highlights) => {
  if (!text) {
    return null;
  }
  const boundaries = new Set([0, text.length]);
  highlights.forEach((highlight) => {
    const start = Math.max(0, highlight.start_index - baseIndex);
    const end = Math.min(text.length, highlight.end_index - baseIndex);
    if (start < end) {
      boundaries.add(start);
      boundaries.add(end);
    }
  });
  const sorted = [...boundaries].sort((a, b) => a - b);
  return sorted.slice(0, -1).map((start, index) => {
    const end = sorted[index + 1];
    const segment = text.slice(start, end);
    const overlapping = getOverlappingHighlights(baseIndex + start, baseIndex + end, highlights);
    const pinned = overlapping.find((highlight) => highlight.kind === "pinned");
    const hovered = overlapping.find((highlight) => highlight.kind === "hovered");
    const active = pinned || hovered;
    if (!active) {
      return renderInlineMarkdown(segment, `seg-${baseIndex}-${start}`);
    }
    return (
      <mark
        key={`highlight-${baseIndex}-${start}-${end}`}
        className={`source-highlight ${active.kind}`}
        data-clean-card-id={active.study_card_id}
      >
        {renderInlineMarkdown(segment, `mark-${baseIndex}-${start}`)}
      </mark>
    );
  });
};

export const renderCleanedMarkdown = (content, highlights) => {
  if (!content) {
    return null;
  }
  const lines = content.split("\n");
  let offset = 0;
  return lines.map((line, index) => {
    const lineStart = offset;
    offset += line.length + 1;
    if (!line.trim()) {
      return <div key={`clean-line-${index}`} className="clean-line-break" />;
    }
    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const markerLength = headingMatch[1].length + 1;
      const text = headingMatch[2];
      const Tag = headingMatch[1].length === 1 ? "h2" : "h3";
      return (
        <Tag key={`clean-line-${index}`}>
          {renderHighlightedText(text, lineStart + markerLength, highlights)}
        </Tag>
      );
    }
    if (line.trimStart().startsWith("- ")) {
      const leading = line.length - line.trimStart().length;
      const textStart = lineStart + leading + 2;
      const text = line.trimStart().slice(2);
      return (
        <p key={`clean-line-${index}`} className="clean-bullet">
          {renderHighlightedText(text, textStart, highlights)}
        </p>
      );
    }
    return (
      <p key={`clean-line-${index}`}>
        {renderHighlightedText(line, lineStart, highlights)}
      </p>
    );
  });
};
