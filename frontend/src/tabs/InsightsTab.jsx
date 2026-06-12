import InsightsBoard from '../components/insights/InsightsBoard';

export default function InsightsTab({ brand }) {
  return <InsightsBoard brandId={brand.id} />;
}