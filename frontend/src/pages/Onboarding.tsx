import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { database } from "@/lib/database";
import { toast } from "sonner";
import { Building2, Users, ArrowRight, CheckCircle2 } from "lucide-react";
import emaraLogo from "@/assets/emara-logo-new.png";

const countries = [
  { value: "AE", label: "United Arab Emirates" },
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "IN", label: "India" },
  { value: "SA", label: "Saudi Arabia" },
  { value: "QA", label: "Qatar" },
  { value: "BH", label: "Bahrain" },
  { value: "KW", label: "Kuwait" },
  { value: "OM", label: "Oman" },
];

const currencies = [
  { value: "AED", label: "AED — UAE Dirham" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "INR", label: "INR — Indian Rupee" },
  { value: "SAR", label: "SAR — Saudi Riyal" },
  { value: "QAR", label: "QAR — Qatari Riyal" },
];

const months = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const industries = [
  "Accounting & Finance",
  "Construction & Real Estate",
  "E-Commerce",
  "Education",
  "Food & Beverage",
  "Healthcare",
  "Hospitality & Tourism",
  "IT & Technology",
  "Manufacturing",
  "Professional Services",
  "Retail & Trading",
  "Transportation & Logistics",
  "Other",
];

export default function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 — Organization
  const [orgName, setOrgName] = useState("");
  const [orgCountry, setOrgCountry] = useState("AE");
  const [orgCurrency, setOrgCurrency] = useState("AED");
  const [vatRate, setVatRate] = useState("5");
  const [fiscalStart, setFiscalStart] = useState("1");

  // Step 2 — Client
  const [clientName, setClientName] = useState("");
  const [clientCurrency, setClientCurrency] = useState("AED");
  const [clientCountry, setClientCountry] = useState("AE");
  const [tradeLicense, setTradeLicense] = useState("");
  const [trn, setTrn] = useState("");
  const [industry, setIndustry] = useState("");

  // Created org ref
  const [orgId, setOrgId] = useState("");

  const handleCreateOrg = async () => {
    if (!orgName.trim()) {
      toast.error("Organization name is required");
      return;
    }
    setSaving(true);
    try {
      const org = await database.createOrganization({
        name: orgName.trim(),
        country: orgCountry,
        default_currency: orgCurrency,
        vat_rate: parseFloat(vatRate) || 5,
        fiscal_year_start: parseInt(fiscalStart) || 1,
      });
      setOrgId(org.id);
      setStep(2);
      toast.success("Organization created");
    } catch (err: any) {
      toast.error(err.message || "Failed to create organization");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateClient = async () => {
    if (!clientName.trim()) {
      toast.error("Client name is required");
      return;
    }
    setSaving(true);
    try {
      await database.createClient(orgId, {
        name: clientName.trim(),
        currency: clientCurrency,
        country: clientCountry,
        industry: industry || undefined,
        trade_license: tradeLicense || undefined,
        trn: trn || undefined,
      });
      queryClient.invalidateQueries();
      toast.success("Client created — welcome to EmeraBooks!");
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Failed to create client");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <img src={emaraLogo} alt="EMARA" className="h-14 w-auto" />
          <p className="text-sm text-muted-foreground">
            Financial Controls Platform
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {step > 1 ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                "1"
              )}
            </div>
            <span className="text-sm font-medium hidden sm:inline">
              Organization
            </span>
          </div>
          <div className="w-12 h-px bg-border" />
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              2
            </div>
            <span className="text-sm font-medium hidden sm:inline">
              First Client
            </span>
          </div>
        </div>

        {/* Step 1: Organization */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Create Your Organization
              </CardTitle>
              <CardDescription>
                This is your firm. You'll manage multiple clients under it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name *</Label>
                <Input
                  id="org-name"
                  placeholder="e.g. Emirates Accounting Services"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Select value={orgCountry} onValueChange={setOrgCountry}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Default Currency</Label>
                  <Select value={orgCurrency} onValueChange={setOrgCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>VAT Rate (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Fiscal Year Start</Label>
                  <Select value={fiscalStart} onValueChange={setFiscalStart}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleCreateOrg}
                disabled={saving || !orgName.trim()}
              >
                {saving ? "Creating..." : "Continue"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: First Client */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Add Your First Client
              </CardTitle>
              <CardDescription>
                This is the company whose books you'll manage. You can add more
                clients later.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client-name">Company Name *</Label>
                <Input
                  id="client-name"
                  placeholder="e.g. Dubai Trading LLC"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Trade License (optional)</Label>
                  <Input
                    placeholder="e.g. 123456"
                    value={tradeLicense}
                    onChange={(e) => setTradeLicense(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>TRN (optional)</Label>
                  <Input
                    placeholder="e.g. 100123456789003"
                    value={trn}
                    onChange={(e) => setTrn(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select
                    value={clientCurrency}
                    onValueChange={setClientCurrency}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Select
                    value={clientCountry}
                    onValueChange={setClientCountry}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Industry</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map((i) => (
                      <SelectItem key={i} value={i}>
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full"
                onClick={handleCreateClient}
                disabled={saving || !clientName.trim()}
              >
                {saving ? "Setting up..." : "Get Started"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
