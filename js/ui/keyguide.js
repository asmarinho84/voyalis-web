// Guia da chave da SerpApi para quem nunca usou: 4 passos, com botões que abrem as páginas certas e colam a chave.
import { esc, icon, openSheet, plural, toast } from "./kit.js";

const SIGNUP = "https://serpapi.com/users/sign_up";
const KEY_PAGE = "https://serpapi.com/manage-api-key";

/**
 * Abre o guia. `engine` salva e testa a chave; `onSaved` é chamado depois de salvar.
 * `web` mostra a opção "lembrar neste aparelho" (no app Android a chave sempre fica no aparelho).
 */
export function openKeyGuide(engine, { web = true, reason = "", onSaved } = {}) {
  const s = engine.settings();
  const sh = openSheet("Sua chave de pesquisa", `
    ${reason ? `<div class="note">${esc(reason)}</div>` : ""}
    <p>Os preços vêm do Google por meio da <b>SerpApi</b>. Para pesquisar, você usa uma chave gratuita sua: são <b>250 buscas por mês, sem pagar nada</b>. Leva uns 2 minutos.</p>
    <ol class="steps">
      <li><div><b class="t">Crie sua conta grátis</b>
        <p>Toque no botão, cadastre seu e-mail (ou entre com Google) e escolha o plano <b>Free</b>. Se pedirem, confirme o e-mail e o celular.</p>
        <a class="btn line sm" href="${SIGNUP}" target="_blank" rel="noopener noreferrer">Abrir cadastro da SerpApi ${icon.out}</a></div></li>
      <li><div><b class="t">Copie a sua chave</b>
        <p>Já logado, abra a página da chave. Ela é uma sequência longa de letras e números. Toque no botão de copiar ao lado dela.</p>
        <div class="mock" aria-hidden="true"><span><b>Your Private API Key</b><br><code>4f2a9c…e81b07</code></span><span class="cp">${icon.paste} Copy</span></div>
        <a class="btn line sm" href="${KEY_PAGE}" target="_blank" rel="noopener noreferrer">Abrir a página da chave ${icon.out}</a></div></li>
      <li><div><b class="t">Cole aqui</b>
        <p>Volte para o Voyalis e toque em <b>Colar</b> (ou segure o dedo no campo e escolha Colar).</p>
        <div class="keyrow"><input type="password" id="kgKey" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Sua chave aparece aqui" aria-label="Chave da SerpApi">
        <button class="btn ghost sm" type="button" id="kgPaste" style="min-height:48px">${icon.paste} Colar</button></div>
        ${web ? `<label class="chk" style="margin-top:10px"><input type="checkbox" id="kgRemember"> Lembrar neste aparelho (desmarque em computador compartilhado)</label>` : ""}</div></li>
      <li><div><b class="t">Confirme e salve</b>
        <p>O Voyalis confere a chave com a SerpApi (isso não gasta buscas) e mostra quantas você tem.</p>
        <button class="btn" type="button" id="kgSave">Conferir e salvar</button>
        <div class="err" id="kgErr" role="alert"></div></div></li>
    </ol>
    <p class="muted small">A chave é pessoal: não compartilhe. Ela fica só no seu navegador ou celular e é enviada apenas para buscar preços. Uma pesquisa completa usa até umas 16 buscas; descobrir destinos usa 1 por região.</p>
    ${s.serpapi_key ? `<button class="btn danger sm" type="button" id="kgRemove">Remover a chave deste aparelho</button>` : ""}`);
  const b = sh.body, input = b.querySelector("#kgKey"), err = b.querySelector("#kgErr");
  input.value = s.serpapi_key;
  const rem = b.querySelector("#kgRemember");
  if (rem) rem.checked = s.remember;
  const showErr = (m) => { err.textContent = m; err.style.display = m ? "block" : "none"; };
  b.querySelector("#kgPaste").onclick = async () => {
    try {
      const t = (await navigator.clipboard.readText()).trim();
      if (!t) return showErr("A área de transferência está vazia. Copie a chave na SerpApi e tente de novo.");
      input.value = t.replace(/\s+/g, "");
      showErr("");
    } catch { showErr("O navegador não deixou colar pelo botão. Segure o dedo no campo e escolha Colar."); input.focus(); }
  };
  b.querySelector("#kgSave").onclick = async () => {
    const key = input.value.trim();
    if (!key) return showErr("Cole a chave no campo do passo 3.");
    const btn = b.querySelector("#kgSave");
    btn.disabled = true; btn.textContent = "Conferindo…";
    try {
      const r = await engine.testKey(key);
      if (!r.valid) {
        showErr(r.reason === "formato" ? "Essa chave parece incompleta. Volte ao passo 2 e copie a chave inteira." : "A SerpApi não reconheceu essa chave. Confira se copiou a chave certa no passo 2.");
      } else {
        engine.saveSettings({ serpapi_key: key, remember: rem ? rem.checked : true });
        sh.close();
        toast(`Chave salva${r.left != null ? `: ${plural(r.left, "busca disponível", "buscas disponíveis")} este mês` : ""}. Agora é só pesquisar!`);
        onSaved?.();
      }
    } catch (x) { showErr(x.message); }
    btn.disabled = false; btn.textContent = "Conferir e salvar";
  };
  const rm = b.querySelector("#kgRemove");
  if (rm) rm.onclick = () => { engine.saveSettings({ serpapi_key: "", remember: true }); sh.close(); toast("Chave removida deste aparelho."); onSaved?.(); };
  return sh;
}
