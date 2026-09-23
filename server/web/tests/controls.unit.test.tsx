import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Button } from "../src/components/ui/button";
import { Checkbox } from "../src/components/ui/checkbox";
import NumericField from "../src/components/NumericField";
import { calendarDay } from "../src/components/DateControl";
import Disclosure from "../src/components/Disclosure";
import { Input } from "../src/components/ui/input";
describe("coss control contracts", () => {
  it("keeps empty numbers distinct from zero", async () => {
    const values: (number | null)[] = [];
    function Example() {
      const [value, setValue] = useState<number | null>(5);
      return (
        <NumericField
          aria-label="Target"
          value={value}
          onValueChange={(n) => {
            setValue(n);
            values.push(n);
          }}
        />
      );
    }
    render(<Example />);
    await userEvent.clear(screen.getByLabelText("Target"));
    expect(screen.getByLabelText("Target")).toHaveValue("");
    expect(values.at(-1)).toBe(null);
    await userEvent.type(screen.getByLabelText("Target"), "0");
    expect(values.at(-1)).toBe(0);
  });
  it("disables a loading submit action", async () => {
    const save = vi.fn();
    render(
      <Button type="submit" loading onClick={save}>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toBeDisabled();
  });
  it("uses a boolean callback for keyboard checkbox selection", async () => {
    const change = vi.fn();
    render(<Checkbox aria-label="List metric" onCheckedChange={change} />);
    screen.getByRole("checkbox").focus();
    await userEvent.keyboard(" ");
    expect(change.mock.calls[0][0]).toBe(true);
  });
  it("retains a draft across disclosure close and reopen", async () => {
    render(
      <Disclosure trigger="Profile">
        <Input aria-label="Draft" defaultValue="" />
      </Disclosure>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Profile" }));
    await userEvent.type(screen.getByLabelText("Draft"), "Synthetic");
    await userEvent.click(screen.getByRole("button", { name: "Profile" }));
    await userEvent.click(screen.getByRole("button", { name: "Profile" }));
    expect(screen.getByLabelText("Draft")).toHaveValue("Synthetic");
  });
  it("serializes a selected calendar day using local fields", () => {
    expect(calendarDay(new Date(2025, 0, 15, 0, 0))).toBe("2025-01-15");
    expect(calendarDay(new Date(2025, 8, 30, 23, 59))).toBe("2025-09-30");
  });
});

// Separate expanders must not acquire accordion-style exclusivity during consolidation.
it("allows independent disclosures to remain expanded", async () => {
  render(
    <>
      <Disclosure trigger="First">
        <Input aria-label="First draft" />
      </Disclosure>
      <Disclosure trigger="Second">
        <Input aria-label="Second draft" />
      </Disclosure>
    </>,
  );
  await userEvent.click(screen.getByRole("button", { name: "First" }));
  await userEvent.click(screen.getByRole("button", { name: "Second" }));
  expect(screen.getByLabelText("First draft")).toBeVisible();
  expect(screen.getByLabelText("Second draft")).toBeVisible();
});
