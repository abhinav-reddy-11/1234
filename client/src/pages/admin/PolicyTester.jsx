import { useState } from "react";
import PolicyChat from "../../components/PolicyChat";
import { PageHeader, Select } from "../../components/ui";

// Lets an admin check what each membership tier would be told.
export default function PolicyTester() {
  const [tier, setTier] = useState("gold");
  return (
    <div>
      <PageHeader title="Policy assistant (test)" subtitle="Ask as a specific tier to verify approval and membership filtering."
        actions={
          <div className="w-40">
            <Select value={tier} onChange={(e) => setTier(e.target.value)} aria-label="Preview tier">
              <option value="bronze">As Bronze</option>
              <option value="silver">As Silver</option>
              <option value="gold">As Gold</option>
            </Select>
          </div>
        } />
      <PolicyChat key={tier} previewTier={tier} />
    </div>
  );
}
