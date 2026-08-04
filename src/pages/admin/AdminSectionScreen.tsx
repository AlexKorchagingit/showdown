import { SectionScreen } from '../../components/SectionScreen';

interface Props {
  title: string;
  backTo: string;
}

export function AdminSectionScreen({ title, backTo }: Props) {
  return <SectionScreen title={title} backTo={backTo} />;
}
