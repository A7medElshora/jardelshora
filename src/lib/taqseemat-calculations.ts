export function calculateTaqseematRemaining(input: {
  daysTotal: number;
  profitTotal: number;
  cigarettesExpenses: number;
  salesExpenses: number;
  outgoingTotal: number;
  carryover: number;
}) {
  return input.daysTotal - input.profitTotal - input.cigarettesExpenses - input.salesExpenses + input.outgoingTotal + input.carryover;
}