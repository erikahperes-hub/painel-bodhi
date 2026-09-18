import { flor } from '../icons.js';

export default {
  titulo: () => 'Prospecção',
  sub: () => 'Funil de novos clientes, em breve.',
  render() {
    return `<div class="card empty">${flor()}<h2>Ainda não montamos essa frente</h2>
      <p>Aqui vai entrar o funil de prospecção: leads em conversa, critérios do perfil ideal e a origem de cada oportunidade. Quando quiserem começar, é só pedir.</p></div>`;
  },
  acoes: {},
};
