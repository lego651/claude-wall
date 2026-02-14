/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import MarkdownRenderer from "@/components/admin/strategies/public/MarkdownRenderer";

describe("MarkdownRenderer", () => {
  it("renders empty content", () => {
    const { container } = render(<MarkdownRenderer content="" />);
    expect(container.querySelector(".prose")).toBeInTheDocument();
  });

  it("renders h1", () => {
    render(<MarkdownRenderer content="# Hello World" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Hello World");
  });

  it("renders h2", () => {
    render(<MarkdownRenderer content="## Section" />);
    expect(screen.getByRole("heading", { name: "Section" })).toBeInTheDocument();
  });

  it("renders bullet list as list", () => {
    render(<MarkdownRenderer content="- Item one\n- Item two" />);
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByText(/Item one/)).toBeInTheDocument();
  });

  it("renders code block input without throwing", () => {
    const { container } = render(<MarkdownRenderer content="```\ncode here\n```" />);
    expect(container.querySelector(".prose")).toBeInTheDocument();
  });

  it("renders paragraph", () => {
    render(<MarkdownRenderer content="A simple paragraph." />);
    expect(screen.getByText("A simple paragraph.")).toBeInTheDocument();
  });

  it("renders inline bold", () => {
    render(<MarkdownRenderer content="**Bold** text" />);
    expect(screen.getByText("Bold")).toBeInTheDocument();
    const strong = document.querySelector("strong");
    expect(strong).toHaveTextContent("Bold");
  });

  it("renders table with header and cells", () => {
    // Trailing newline so parser flushes table (table ends when next line does not start with |)
    render(
      <MarkdownRenderer
        content={`| A | B |
| - | - |
| 1 | 2 |

`}
      />
    );
    const table = document.querySelector("table");
    expect(table).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});
