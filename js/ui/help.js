// Conteúdo da Ajuda: tudo o que o usuário precisa saber para usar e interpretar o app.
import { BANDS } from "../core/index.js";
import { esc } from "./kit.js";

const sec = (title, body, open = false) => `<details ${open ? "open" : ""}><summary>${esc(title)}</summary><div class="body">${body}</div></details>`;

export function helpHTML(version) {
  return `<div class="help">
  ${sec("O que o Voyalis faz", `<p>O Voyalis pesquisa preços reais de passagens, hospedagem e atrações e organiza tudo para você decidir a viagem com calma. Há dois jeitos de usar:</p>
    <dl><dt>Planejar viagem</dt><dd>Você já sabe para onde quer ir. Informe origem, destino, datas e pessoas: o app entrega voos, hospedagem, atrações, segurança e custo de vida do destino e uma estimativa do custo total.</dd>
    <dt>Descobrir destinos</dt><dd>Você sabe de onde sai e quando pode viajar, mas não para onde. O app lista os destinos do mais barato para o mais caro e pinta os mapas do Brasil e do mundo por faixa de preço.</dd></dl>`, true)}

  ${sec("Planejar viagem: o que vem pronto", `<ul>
    <li><b>Resumo:</b> o cartão de embarque mostra a rota, as datas e o custo estimado da viagem (passagens do grupo + noites no hotel mais barato), além dos destaques de cada parte.</li>
    <li><b>Voos:</b> todas as ofertas encontradas, do menor para o maior preço, com filtros por paradas e companhia. A melhor oferta já vem com a volta confirmada e com a comparação de onde comprar.</li>
    <li><b>Calendário:</b> com datas flexíveis, mostra o menor preço para cada combinação de ida e volta. Toque numa data para ver os voos dela.</li>
    <li><b>Hospedagem:</b> hotéis com preço por noite, total da estadia, nota, distância e a comparação de preço entre os sites (Booking, site oficial e outros).</li>
    <li><b>Atrações:</b> pontos turísticos do destino, com nota e localização. Agências e lojas de turismo ficam de fora.</li>
    <li><b>Destino:</b> segurança e custo de vida do país, com links para informações locais.</li>
    <li><b>Alertas:</b> acompanhe o preço desta rota e seja avisado quando cair.</li></ul>`)}

  ${sec("Como ler os preços", `<ul>
    <li>Preços de voo são <b>por pessoa, ida e volta</b>, em reais. O total do grupo é uma estimativa (preço por pessoa × número de pessoas): crianças podem pagar menos.</li>
    <li>Normalmente o preço já inclui as taxas obrigatórias; bagagem despachada e escolha de assento podem ser cobradas à parte.</li>
    <li><b>Escondida:</b> oferta pelo menos 5% mais barata que a busca exata, encontrada mudando a data em até alguns dias ou usando um aeroporto próximo.</li>
    <li><b>2 bilhetes separados:</b> ida por uma companhia e volta por outra. Pode sair mais barato, mas bagagem e conexões não são integradas.</li>
    <li><b>Avaliação do Google:</b> quando disponível, diz se o preço está baixo, típico ou alto para a rota.</li>
    <li><b>Onde comprar:</b> compara a companhia aérea com as agências. Preço muito abaixo da companhia gera um aviso: é um sinal para conferir a reputação do vendedor, não prova de fraude.</li>
    <li>Os preços mudam o tempo todo. Sempre confira o valor final no site antes de pagar.</li></ul>`)}

  ${sec("Mapas e cores", `<p>No Descobrir destinos, cada estado ou país recebe a cor do destino mais barato dele (preço por pessoa, ida e volta):</p>
    <div class="legend">${BANDS.map((b) => `<span class="lg"><i style="background:${b.color}"></i>${esc(b.label)}</span>`).join("")}<span class="lg"><i style="background:var(--none)"></i>Sem destino nesta pesquisa</span></div>
    <p>Toque num estado para ver as cidades dele no mapa e voltar aos estados quando quiser. Toque num país para ver os destinos dele. Em qualquer destino, use <b>Montar viagem completa</b> para pesquisar voos, hospedagem e atrações daquele lugar.</p>`)}

  ${sec("Segurança e custo de vida", `<ul>
    <li><b>Homicídios por 100 mil habitantes</b> (Banco Mundial): indicador geral do país, não da cidade nem do bairro. As faixas baixo, moderado, alto e muito alto são uma referência deste app.</li>
    <li><b>Nível de preços</b> e <b>comparação com o Brasil</b>: quanto a vida no país custa em relação ao Brasil, considerando a economia toda. Hotéis e restaurantes turísticos podem fugir dessa média.</li>
    <li>Para a situação atual do lugar, use os links de segurança e custo de vida da aba Destino.</li></ul>`)}

  ${sec("Buscas e saldo", `<p>Os preços vêm da SerpApi, um serviço que consulta o Google. Cada consulta gasta 1 busca do seu saldo (o plano gratuito tem 250 por mês). O saldo aparece no topo da tela.</p>
    <ul><li>Antes de pesquisar, o app mostra quantas buscas vai usar, no máximo.</li>
    <li>Planejar viagem: 1 busca por combinação de datas e aeroportos (limite ajustável em Configurações), 2 para bilhetes separados, 2 para a volta e os vendedores da melhor oferta, 1 para hotéis e 1 para atrações.</li>
    <li>Descobrir destinos: 1 busca por região marcada. Repetir a mesma pesquisa em até 12 horas não gasta nada.</li>
    <li>Segurança e custo de vida não gastam buscas.</li>
    <li>A última pesquisa fica salva: ao abrir o app de novo, ela aparece sem gastar buscas.</li></ul>`)}

  ${sec("Alertas de preço", `<p>Crie um alerta na aba Alertas de uma viagem pesquisada. O app avisa quando o preço ficar abaixo do valor que você escolher, cair a porcentagem definida ou chegar ao menor preço já visto.</p>
    <p>O Android não permite que o app consulte preços com ele fechado: os alertas são checados enquanto o app está aberto e sempre que você o abre. Cada checagem gasta algumas buscas.</p>`)}

  ${sec("Sua chave de pesquisa (grátis)", `<p>Os preços vêm do Google por meio da SerpApi. Cada pessoa usa a própria chave gratuita, com 250 buscas por mês. Toque no ícone da chave, no topo da tela, e siga os 4 passos: criar a conta, copiar a chave, colar e salvar.</p>
    <p><b>Sem chave</b>, o Voyalis ainda monta a sua viagem com links prontos para comparar nos sites (passagens, hotéis e passeios) e mostra a segurança e o custo de vida do destino. Os preços, as ofertas escondidas e o mapa de destinos aparecem quando a chave é conectada.</p>`)}

  ${sec("Privacidade e segurança", `<ul>
    <li>Não há cadastro, login, anúncios nem rastreamento.</li>
    <li>Sua chave fica só no seu aparelho. No site, ela vai protegida (HTTPS) para o intermediário do Voyalis, que só a repassa à SerpApi para buscar preços e não a guarda.</li>
    <li>No computador de outra pessoa, desmarque “Lembrar neste aparelho”: a chave some quando o navegador fecha.</li>
    <li>Suas pesquisas e alertas ficam só no seu aparelho. Em Configurações você pode apagar tudo.</li></ul>`)}

  ${sec("Limites que você precisa conhecer", `<ul>
    <li>O Descobrir destinos mostra os destinos mais baratos que o Google encontra para cada região, não todos os voos que existem.</li>
    <li>Os preços são os do momento da pesquisa e podem mudar na hora da compra.</li>
    <li>O app não vende passagens nem hospedagem: ele leva você aos sites que vendem.</li>
    <li>Segurança e custo de vida são dados do país, atualizados uma vez por ano pelo Banco Mundial.</li></ul>`)}

  <p class="muted small" style="margin-top:16px">Voyalis ${esc(version)}. Dados: Google (via SerpApi), Banco Mundial (CC BY 4.0), Natural Earth, OurAirports. Fontes Barlow (SIL OFL).</p>
  </div>`;
}
