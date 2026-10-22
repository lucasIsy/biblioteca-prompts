# Biblioteca de Prompts

Aplicativo desktop para Windows que guarda, organiza e reaproveita seus prompts de IA. Cada prompt tem texto em markdown e, se você quiser, uma imagem ou vídeo de exemplo do resultado. Tudo fica no seu computador: sem conta, sem nuvem, sem internet.

> **Status:** em desenvolvimento (v0.1.0).

## Contribua

Este projeto está sendo desenvolvido com o [Claude Code](https://claude.com/claude-code). Ajudas são sempre bem-vindas: abra uma issue com ideias, bugs ou sugestões, ou envie um pull request.

## Para que serve

Quem usa IA com frequência acaba com prompts espalhados em notas, chats e pastas. Aqui eles ficam num só lugar, com o resultado ao lado para você lembrar o que cada um produz:

- **Imagens e Vídeos** aparecem em uma **galeria em carrossel 3D**, com prévia da mídia.
- **Sites, Apps, Outros** e as categorias que você criar aparecem em **grade**.
- O prompt é mostrado como **markdown renderizado**, e o botão **Copiar** entrega o **markdown original**, pronto para colar na IA.

## Veja funcionando

![Carrossel 3D de imagens e abertura de um prompt](assets/demo.gif)

![Grade de prompts com busca e filtros](assets/grade.png)

## Detalhes

### E se eu formatar o PC ou trocar de computador?

Use **Configurações › Backup**. Marque as categorias que quer guardar e clique em **Exportar .zip**: o arquivo leva os prompts, as categorias, as subcategorias e a mídia. Em outra instalação, **Importar .zip** traz tudo de volta.

- Importar nunca apaga nada.
- Prompts idênticos (mesma categoria, título e texto) são pulados, então importar duas vezes não duplica.

![Tela de backup](assets/backup.png)

### O vídeo aparece parado ou em movimento?

Parado até você pedir: o card mostra um quadro do vídeo, e **ao passar o mouse ele toca, sem som**. Ao tirar o mouse, para. Só MP4 (H.264) e WebM são aceitos.

![Preview de vídeo animado](assets/video-preview.gif)

### Posso criar minhas próprias categorias?

Sim. Em **Configurações**, crie categorias e, dentro de cada uma, **subcategorias**: etiquetas que você usa para filtrar. Um prompt pode ter várias.

- Categorias novas aparecem em grade; só **Imagens** e **Vídeos** usam a galeria 3D.
- Imagens e Vídeos não podem ser excluídas.

![Categorias e subcategorias](assets/categorias.png)

### Como edito um prompt?

Abra o prompt e clique em **Editar**. Dá para mudar nome, categoria, subcategorias e o texto, com abas **Editar** e **Visualizar** para ver o markdown renderizado. A mídia pode ser trocada por clique, **Ctrl+V** ou arrastando o arquivo para a janela.

![Editor de prompt](assets/editar.png)

### O que acontece quando eu excluo?

- **Prompt:** é removido junto com seus arquivos de mídia.
- **Categoria com prompts:** o app pergunta o que fazer: **excluir os prompts**, **movê-los para "Sem categoria"** ou **cancelar**.

![Exclusão de categoria](assets/excluir.png)

## Licença

[MIT](LICENSE)
