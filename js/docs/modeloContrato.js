// Minuta padrão. As cláusulas podem ser editadas em Configurações > Modelo de contrato,
// sem mexer em código. Trechos entre {{chaves}} são preenchidos com os dados de cada contrato.
export const PREAMBULO_PADRAO =
  'Pelo presente instrumento particular, de um lado {{contratante}}, inscrita no CNPJ sob o nº {{contratante_cnpj}}, com sede em {{contratante_endereco}}, neste ato representada por {{contratante_representante}}, doravante denominada CONTRATANTE; e, de outro lado, {{contratada}}, inscrita no CNPJ sob o nº {{contratada_cnpj}}, com sede em {{contratada_endereco}}, neste ato representada por {{contratada_representante}}, doravante denominada CONTRATADA, têm entre si justo e contratado o que segue.';

export const CLAUSULAS_PADRAO = [
  { id: 'objeto', titulo: 'Do objeto', texto: 'O presente contrato tem por objeto a prestação, pela CONTRATADA à CONTRATANTE, de serviços de {{objeto}}, nos termos e condições descritos a seguir.' },
  { id: 'escopo', titulo: 'Do escopo dos serviços', texto: 'Os serviços contratados compreendem:\n{{escopo}}\nServiços adicionais, fora do escopo acima, geram taxa extra, previamente acordada entre as partes.' },
  { id: 'vigencia', titulo: 'Da vigência', texto: 'O contrato terá vigência de {{prazo_meses}} meses, de {{inicio}} a {{fim}}, podendo ser renovado por acordo entre as partes.' },
  { id: 'pagamento', titulo: 'Do valor e do pagamento', texto: 'Pelos serviços prestados, a CONTRATANTE pagará à CONTRATADA o valor mensal de {{valor}} ({{valor_extenso}}), até o dia {{dia_pagamento}} de cada mês, por {{forma_pagamento}}.' },
  { id: 'atraso', titulo: 'Do atraso no pagamento', quando: 'multa_atraso', texto: 'Após {{carencia}} de atraso, incidirão multa de {{multa_atraso}}% e juros de {{juros_atraso}}% ao mês sobre o valor devido.' },
  { id: 'propriedade', titulo: 'Da propriedade dos materiais', quando: 'propriedade', texto: 'Os materiais e documentos produzidos no âmbito deste contrato permanecem com {{propriedade}}.' },
  { id: 'rescisao', titulo: 'Da rescisão', quando: 'aviso_previo', texto: 'Qualquer das partes poderá rescindir este contrato a qualquer tempo, mediante aviso prévio por escrito de {{aviso_previo}} dias.' },
  { id: 'permanencia', titulo: 'Da permanência mínima', quando: 'permanencia', texto: 'As partes acordam permanência mínima de {{permanencia}} meses de contrato.' },
  { id: 'multa', titulo: 'Da multa por rescisão antecipada', quando: 'multa_rescisoria', texto: 'Em caso de rescisão antes do fim da permanência mínima, a parte que der causa pagará multa de {{multa_rescisoria}}.' },
  { id: 'reajuste', titulo: 'Do reajuste', quando: 'reajuste', texto: 'O valor mensal será reajustado {{reajuste}}.' },
  { id: 'foro', titulo: 'Do foro', quando: 'foro', texto: 'Fica eleito o foro da comarca de {{foro}} para dirimir quaisquer questões oriundas deste contrato.' },
];

export const VARIAVEIS = [
  'contratante', 'contratante_cnpj', 'contratante_endereco', 'contratante_representante',
  'contratada', 'contratada_cnpj', 'contratada_endereco', 'contratada_representante',
  'objeto', 'escopo', 'inicio', 'fim', 'prazo_meses', 'valor', 'valor_extenso', 'dia_pagamento', 'forma_pagamento',
  'carencia', 'multa_atraso', 'juros_atraso', 'aviso_previo', 'propriedade', 'permanencia', 'multa_rescisoria', 'reajuste', 'foro',
];
