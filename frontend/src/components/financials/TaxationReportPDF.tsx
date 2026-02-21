import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import { formatCurrencyValue } from "@/lib/chartColors";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  header: { marginBottom: 20, borderBottom: "2px solid #1a1a2e", paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: "bold", color: "#1a1a2e", fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 11, color: "#555", marginTop: 4 },
  date: { fontSize: 10, color: "#888", marginTop: 2 },
  section: { marginTop: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "bold", fontFamily: "Helvetica-Bold", color: "#1a1a2e", marginBottom: 8, borderBottom: "1px solid #ddd", paddingBottom: 4 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 },
  summaryCard: { width: "30%", padding: 10, backgroundColor: "#f8f9fa", borderRadius: 4, border: "1px solid #e9ecef", marginBottom: 4 },
  summaryLabel: { fontSize: 8, color: "#666", marginBottom: 4 },
  summaryValue: { fontSize: 14, fontWeight: "bold", fontFamily: "Helvetica-Bold" },
  tableHeader: { flexDirection: "row", backgroundColor: "#1a1a2e", padding: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  tableHeaderText: { color: "#fff", fontWeight: "bold", fontFamily: "Helvetica-Bold", fontSize: 9 },
  tableRow: { flexDirection: "row", padding: 8, borderBottom: "1px solid #e9ecef" },
  tableRowHighlight: { flexDirection: "row", padding: 8, borderBottom: "1px solid #e9ecef", backgroundColor: "#f0f4ff" },
  tableRowTotal: { flexDirection: "row", padding: 8, borderBottom: "1px solid #e9ecef", backgroundColor: "#e9ecef" },
  bold: { fontFamily: "Helvetica-Bold" },
  indent: { paddingLeft: 16, color: "#666" },
  negative: { color: "#dc3545" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, textAlign: "center", fontSize: 8, color: "#aaa", borderTop: "1px solid #eee", paddingTop: 8 },
  // Column widths for different tables
  cellDesc: { width: "65%" },
  cellAmount: { width: "35%", textAlign: "right" },
  // Revenue by customer columns
  custName: { width: "30%" },
  custCount: { width: "12%", textAlign: "center" },
  custSubtotal: { width: "20%", textAlign: "right" },
  custVat: { width: "18%", textAlign: "right" },
  custNet: { width: "20%", textAlign: "right" },
  // Vendor columns
  vendName: { width: "40%" },
  vendCount: { width: "15%", textAlign: "center" },
  vendTotal: { width: "25%", textAlign: "right" },
  vendPct: { width: "20%", textAlign: "right" },
  // Monthly columns
  monMonth: { width: "16%" },
  monCol: { width: "16.8%", textAlign: "right" },
  // VAT summary
  vatBox: { width: "30%", padding: 10, backgroundColor: "#f8f9fa", borderRadius: 4, border: "1px solid #e9ecef" },
  vatLabel: { fontSize: 9, color: "#666", marginBottom: 4 },
  vatValue: { fontSize: 13, fontWeight: "bold", fontFamily: "Helvetica-Bold" },
});

interface RevenueByCustomer {
  name: string;
  count: number;
  subtotal: number;
  vat: number;
  net: number;
}

interface ExpenseByVendor {
  name: string;
  count: number;
  total: number;
}

interface MonthlySummary {
  month: string;
  revenue: number;
  vat: number;
  expenses: number;
  taxableProfit: number;
  corpTax: number;
}

export interface TaxationReportPDFProps {
  companyName: string;
  currency: string;
  totalRevenue: number;
  vatAmount: number;
  revenueAfterVAT: number;
  totalExpenses: number;
  netProfitBeforeTax: number;
  corpTaxAmount: number;
  netProfitAfterTax: number;
  totalTaxBurden: number;
  effectiveTaxRate: number;
  revenueByCustomer?: RevenueByCustomer[];
  expenseByVendor?: ExpenseByVendor[];
  monthlySummary?: MonthlySummary[];
  outputVAT?: number;
  inputVAT?: number;
  netVATPayable?: number;
}

function TaxationReportPDFDocument(props: TaxationReportPDFProps) {
  const {
    companyName, currency, totalRevenue, vatAmount, revenueAfterVAT,
    totalExpenses, netProfitBeforeTax, corpTaxAmount, netProfitAfterTax,
    totalTaxBurden, effectiveTaxRate, revenueByCustomer = [], expenseByVendor = [],
    monthlySummary = [], outputVAT = 0, inputVAT = 0, netVATPayable = 0,
  } = props;

  const fmt = (v: number) => formatCurrencyValue(v, currency);
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const rows = [
    { label: "Gross Revenue", value: totalRevenue, bold: true },
    { label: "Less: VAT (5%)", value: -vatAmount, indent: true },
    { label: "Revenue After VAT", value: revenueAfterVAT, bold: true },
    { label: "Less: Operating Expenses", value: -totalExpenses, indent: true },
    { label: "Net Profit Before Corporate Tax", value: netProfitBeforeTax, bold: true },
    { label: "Less: Corporate Tax (9%)", value: -corpTaxAmount, indent: true },
    { label: "Net Profit After All Taxes", value: netProfitAfterTax, bold: true, highlight: true },
  ];

  const pageFooter = (
    <Text style={styles.footer}>
      This report is auto-generated. Please consult a tax professional for official filings.
    </Text>
  );

  return (
    <Document>
      {/* Page 1: Summary + Tax Breakdown */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Taxation Report</Text>
          <Text style={styles.subtitle}>{companyName || "Company"}</Text>
          <Text style={styles.date}>Generated on {today}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Revenue</Text>
              <Text style={styles.summaryValue}>{fmt(totalRevenue)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>VAT (5%)</Text>
              <Text style={[styles.summaryValue, { color: "#d97706" }]}>{fmt(vatAmount)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Expenses</Text>
              <Text style={[styles.summaryValue, { color: "#dc3545" }]}>{fmt(totalExpenses)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Corporate Tax (9%)</Text>
              <Text style={[styles.summaryValue, { color: "#dc3545" }]}>{fmt(corpTaxAmount)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Tax Burden</Text>
              <Text style={styles.summaryValue}>{fmt(totalTaxBurden)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Net After Tax</Text>
              <Text style={[styles.summaryValue, { color: "#198754" }]}>{fmt(netProfitAfterTax)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tax Breakdown</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.cellDesc]}>Description</Text>
            <Text style={[styles.tableHeaderText, styles.cellAmount]}>Amount</Text>
          </View>
          {rows.map((row) => (
            <View key={row.label} style={row.highlight ? styles.tableRowHighlight : styles.tableRow}>
              <Text style={[styles.cellDesc, row.bold ? styles.bold : {}, row.indent ? styles.indent : {}]}>
                {row.label}
              </Text>
              <Text style={[styles.cellAmount, row.bold ? styles.bold : {}, row.value < 0 ? styles.negative : {}]}>
                {row.value < 0 ? `(${fmt(Math.abs(row.value))})` : fmt(row.value)}
              </Text>
            </View>
          ))}
        </View>

        <View style={[styles.section, { marginTop: 16 }]}>
          <Text style={{ fontSize: 10, color: "#555" }}>
            Effective Tax Rate: {effectiveTaxRate.toFixed(1)}%
          </Text>
        </View>
        {pageFooter}
      </Page>

      {/* Page 2: Revenue by Customer + Expense by Vendor */}
      {(revenueByCustomer.length > 0 || expenseByVendor.length > 0) && (
        <Page size="A4" style={styles.page}>
          {revenueByCustomer.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Revenue Breakdown by Customer</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, styles.custName]}>Customer</Text>
                <Text style={[styles.tableHeaderText, styles.custCount]}>Invoices</Text>
                <Text style={[styles.tableHeaderText, styles.custSubtotal]}>Subtotal</Text>
                <Text style={[styles.tableHeaderText, styles.custVat]}>VAT (5%)</Text>
                <Text style={[styles.tableHeaderText, styles.custNet]}>Net</Text>
              </View>
              {revenueByCustomer.map((row) => (
                <View key={row.name} style={styles.tableRow}>
                  <Text style={[styles.custName, { fontSize: 9 }]}>{row.name}</Text>
                  <Text style={[styles.custCount, { fontSize: 9 }]}>{row.count}</Text>
                  <Text style={[styles.custSubtotal, { fontSize: 9 }]}>{fmt(row.subtotal)}</Text>
                  <Text style={[styles.custVat, { fontSize: 9, color: "#d97706" }]}>{fmt(row.vat)}</Text>
                  <Text style={[styles.custNet, { fontSize: 9 }, styles.bold]}>{fmt(row.net)}</Text>
                </View>
              ))}
            </View>
          )}

          {expenseByVendor.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Expense Breakdown by Vendor</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, styles.vendName]}>Vendor</Text>
                <Text style={[styles.tableHeaderText, styles.vendCount]}>Bills</Text>
                <Text style={[styles.tableHeaderText, styles.vendTotal]}>Total</Text>
                <Text style={[styles.tableHeaderText, styles.vendPct]}>% of Exp.</Text>
              </View>
              {expenseByVendor.map((row) => (
                <View key={row.name} style={styles.tableRow}>
                  <Text style={[styles.vendName, { fontSize: 9 }]}>{row.name}</Text>
                  <Text style={[styles.vendCount, { fontSize: 9 }]}>{row.count}</Text>
                  <Text style={[styles.vendTotal, { fontSize: 9 }]}>{fmt(row.total)}</Text>
                  <Text style={[styles.vendPct, { fontSize: 9 }]}>
                    {totalExpenses > 0 ? ((row.total / totalExpenses) * 100).toFixed(1) : "0"}%
                  </Text>
                </View>
              ))}
            </View>
          )}
          {pageFooter}
        </Page>
      )}

      {/* Page 3: Monthly Summary + VAT Summary + Tax Rates */}
      {(monthlySummary.length > 0) && (
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Monthly Tax Summary</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.monMonth]}>Month</Text>
              <Text style={[styles.tableHeaderText, styles.monCol]}>Revenue</Text>
              <Text style={[styles.tableHeaderText, styles.monCol]}>VAT</Text>
              <Text style={[styles.tableHeaderText, styles.monCol]}>Expenses</Text>
              <Text style={[styles.tableHeaderText, styles.monCol]}>Tax. Profit</Text>
              <Text style={[styles.tableHeaderText, styles.monCol]}>Corp Tax</Text>
            </View>
            {monthlySummary.map((row) => (
              <View key={row.month} style={styles.tableRow}>
                <Text style={[styles.monMonth, { fontSize: 9 }, styles.bold]}>{row.month}</Text>
                <Text style={[styles.monCol, { fontSize: 9 }]}>{fmt(row.revenue)}</Text>
                <Text style={[styles.monCol, { fontSize: 9, color: "#d97706" }]}>{fmt(row.vat)}</Text>
                <Text style={[styles.monCol, { fontSize: 9, color: "#dc3545" }]}>{fmt(row.expenses)}</Text>
                <Text style={[styles.monCol, { fontSize: 9 }]}>
                  {row.taxableProfit < 0 ? `(${fmt(Math.abs(row.taxableProfit))})` : fmt(row.taxableProfit)}
                </Text>
                <Text style={[styles.monCol, { fontSize: 9 }]}>{fmt(row.corpTax)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>VAT Summary</Text>
            <View style={styles.summaryRow}>
              <View style={styles.vatBox}>
                <Text style={styles.vatLabel}>Output VAT (Revenue)</Text>
                <Text style={styles.vatValue}>{fmt(outputVAT)}</Text>
              </View>
              <View style={styles.vatBox}>
                <Text style={styles.vatLabel}>Input VAT (Expenses)</Text>
                <Text style={styles.vatValue}>{fmt(inputVAT)}</Text>
              </View>
              <View style={[styles.vatBox, { backgroundColor: "#f0f4ff", borderColor: "#c7d2fe" }]}>
                <Text style={styles.vatLabel}>Net VAT Payable</Text>
                <Text style={[styles.vatValue, { color: netVATPayable >= 0 ? "#dc3545" : "#198754" }]}>
                  {netVATPayable >= 0 ? fmt(netVATPayable) : `(${fmt(Math.abs(netVATPayable))})`}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tax Rates & Thresholds</Text>
            <View style={styles.tableRow}>
              <Text style={[styles.cellDesc, styles.bold]}>VAT Rate</Text>
              <Text style={[styles.cellAmount, styles.bold]}>5%</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.cellDesc, styles.bold]}>Corporate Tax Rate</Text>
              <Text style={[styles.cellAmount, styles.bold]}>9%</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.cellDesc}>Taxable Income Threshold</Text>
              <Text style={styles.cellAmount}>AED 375,000</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.cellDesc}>Small Business Relief (Revenue ≤ AED 3M)</Text>
              <Text style={[styles.cellAmount, { color: "#198754" }]}>0% (conditions apply)</Text>
            </View>
          </View>
          {pageFooter}
        </Page>
      )}
    </Document>
  );
}

export async function downloadTaxationPDF(props: TaxationReportPDFProps) {
  const blob = await pdf(<TaxationReportPDFDocument {...props} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "taxation-report.pdf";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
