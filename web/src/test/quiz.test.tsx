import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { GraveyardQuiz } from "@/components/GraveyardQuiz";

describe("graveyard quiz", () => {
  it("shows the intro while a run is in progress", () => {
    render(<GraveyardQuiz running={true} />);
    expect(screen.getByText(/bit the dust/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /play/i })).toBeTruthy();
  });
  it("renders nothing when no run is in progress", () => {
    const { container } = render(<GraveyardQuiz running={false} />);
    expect(container.innerHTML).toBe("");
  });
});
