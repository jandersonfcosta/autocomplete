/*
	Autocomplete 1.1.0
	Criado por Janderson Costa em 20/05/2016.

	Descrição:
		Implementa no campo especificado uma lista de opções que varia conforme o termo digitado pelo usuário.
		Percorrendo os itens acima ou abaixo na lista através das setas do teclado, o campo recebe o valor do item atual selecionado.

	Dependências:
		jquery 1.4.2+

	Pripriedades:
		args.field: input ou textarea
		args.delay: 350 (padrão) - tempo para execução após digitação
		args.remote: recebe uma função do padrão function(term, callback) {}
		args.items: array de itens que serão listados no dropdown - ["text", "text", ..] ou [{ text: text, value: value }, ..]
		args.dropdownHeight: nº linas do dropdown o que afeta também sua altura
		args.allowAnyValue: false ou true (padrão) - permite qualquer valor digitado
		args.icon: false ou true (padrão) - exibe o ícone a direita do campo

	Uso:
		// html
		<input id="field1" type="text" />
		
		// js
		autocomplete({
			field: $("#field1"),
			items: ["banana", "melão", "uva", "pera", "laranja", "maçã"],
			icon: false,
			selectItem: function(result) {
				// result: { value: value, text: text }

				console.log(result);
			}
		});

		autocomplete({
			field: $("#field1"),
			delay: 500,
			allowAnyValue: false,
			remote: getFruits,
			selectItem: function(result) {
				console.log(result);
			}
		});

		function getFruits(term, callback) {
			//..

			callback(items);
		}
*/


// objeto compartilhado com autocomplete()
var AC_ELEMENT = {};

(function() {

	var resourceUrl = "/_dev/lib/autocomplete/1.1.0";

	// CSS
	var href = resourceUrl + "/css/autocomplete.min.css";
	$("head").append('<link rel="stylesheet" href="' + href + '">');

	// COMPONENTE
	// ícone
	AC_ELEMENT.iconImage = {
		search: resourceUrl + "/img/search.png",
		loader: resourceUrl + "/img/loading.gif"
	};
	AC_ELEMENT.icon = $('<img class="autocomplete-field-icon">')
	.attr({
		src: AC_ELEMENT.iconImage.search,
		border: 0
	});

	// dropdown
	AC_ELEMENT.dropdown = $('<div class="autocomplete-dropdown">');

	// item - template
	AC_ELEMENT.item = $('<div class="autocomplete-dropdown-item">')
	.attr({
		name: "item",
		value: "",
		text: ""
	});

	AC_ELEMENT.addEvent = addEvent;
	AC_ELEMENT.removeEvent = removeEvent;
	AC_ELEMENT.stopPropagation = stopPropagation;
	
	// configura o dropdown
	setDropdown(AC_ELEMENT.dropdown);

	// insere os componentes na página
	$("body").append(AC_ELEMENT.dropdown, AC_ELEMENT.icon);

	// FUNÇÕES
	function setDropdown(dropdown) {
		// evento - selectstart - cancela seleção
		dropdown.bind("selectstart", function() {
			return false;
		});

		// evento - mousedown - impede que o dropdown feche ao clicar no mesmo devido ao evento mousedown implementado no html
		dropdown[0].onmousedown = stopPropagation;
	}

	function addEvent(element, event, f) {
		// adiciona um novo evento no elemento preservando os atuais

		if (element.addEventListener) // for all major browsers, except IE 8 and earlier
			element.addEventListener(event, f);
		else if (element.attachEvent) // for IE 8 and earlier versions
			element.attachEvent("on" + event, f);
	}

	function removeEvent(element, event, f) {
		// remove o evento do elemento preservando os outros atuais

		if (element.removeEventListener)
			element.removeEventListener(event, f, false);
		else if (element.detachEvent)
			element.detachEvent("on" + event, f);
	}

	function stopPropagation() {
		// impede que o disparo do evento de um elemento seja propagado para o elemento pai

		window.event.cancelBubble = true;
		window.event.returnValue = false;
	}
})();

function autocomplete(args) {

	// VARIÁVEIS GLOBAIS
	var
	html = document.body.parentNode,
	dropdown = AC_ELEMENT.dropdown,
	itemTemplate = AC_ELEMENT.item,
	icon = AC_ELEMENT.icon,
	field = args.field,
	acid = "";// autocomplete id auxiliar

	// PROPRIEDADES
	args.items = args.items || [];
	args.remote = args.remote || false;
	args.dropdownHeight = args.dropdownHeight || 12;
	args.delay = args.delay || 350;
	args.allowAnyValue = args.allowAnyValue !== undefined && args.allowAnyValue === false ? false : true;
	args.itemHeight = 19; // ver css
	args.itemWidth = 0;
	args.icon = args.icon !== undefined && args.icon === true ? true : false;
	args.autocomplete = { // um dos objetos retornados no callback
		dropdown: dropdown,
		item: itemTemplate
	};

	// CONFIGURAÇÃO
	setField();

	// EVENTOS
	// html - mousedown - sai do dropdown
	AC_ELEMENT.addEvent(html, "mousedown", cancel);

	// FUNÇÕES
	function setField() {
		// css
		field.css({
			"display": "block" // necessário para que o dropdown seja exibido logo abaixo
		});

		// ícone
		if (args.icon) {
			icon = icon.clone();

			field.before(icon.css({
				display: "inline-block",
				left: field.width() + 17
			}));

			args.autocomplete.icon = icon;
		}

		// evento - focus
		field.focus(function() {
			// id auxiliar
			acid = new Date().getTime().toString();
			$(this).attr("acid", acid);

			// guarda o valor original
			$(this).attr("originalvalue", $(this).val());
		});

		// evento - blur
		field.blur(function() {
			if (!args.allowAnyValue)
				cancel();
		});

		// evento - keyup - pesquisa
		field.keyup(function(event) {
			var term = $.trim($(this).val());

			// diferente das setas, enter e esc
			if ((event.keyCode < 37 || event.keyCode > 40) && event.keyCode != 13 && event.keyCode != 27) {
				// aborta a thread
				if (typeof(autocomplete_thread) !== "undefined")
					clearTimeout(autocomplete_thread);

				// inicia a thread
				autocomplete_thread = setTimeout(function() {
					complete(term);
				}, args.delay);
			}
		});

		// evento - keydown - up/down/enter/tab/esc
		field.keydown(function(event) {
			var
			detachedItem = dropdown.find('div[detached="true"]'),
			item = detachedItem;

			// seta para baixo
			if (event.keyCode === 40) {
				// para a rotina se o dropdown estiver oculto
				if (!dropdownIsOpen())
					return false;

				// destaca o item
				if (detachedItem.length > 0)
					item = detachedItem.next();
				else
					item = dropdown.find("div").eq(0);

				detachItem(item);

				if (item.index() >= 0) {
					// valor do campo
					$(this).val(item.text());

					// scroll
					var scrollTop = item.index() * args.itemHeight;
					dropdown.scrollTop(scrollTop);
				}
			}

			// seta para cima
			if (event.keyCode === 38) {
				// para a rotina se o dropdown estiver oculto
				if (!dropdownIsOpen())
					return false;

				if (detachedItem.length > 0 && detachedItem.index() > 0) {
					item = detachedItem.prev();
					detachItem(item);

					// valor do campo
					$(this).val(item.text());

					// scroll
					var scrollTop = item.index() * args.itemHeight;
					dropdown.scrollTop(scrollTop);
				}
			}

			// enter
			if (event.keyCode === 13) {
				// seleciona o item destacado
				selectItem(item);
				return false;
			}

			// tab
			if (event.keyCode === 9)
				cancel();

			// esc
			if (event.keyCode === 27)
				cancel();
		});

		// evento - paste
		field.bind("paste", function() {
			// impede ctrl-v
			if (args.allowAnyValue === false)
				return false;
		});

		// evento - drop
		field.bind("drop", function() {
			// impede arrastar valor para dentro do campo
			if (args.allowAnyValue === false)
				return false;
		});

		function complete(term) {
			// preloader
			loader("show");

			if (term.length >= 2) {
				if (args.remote) {
					args.remote(term, function(items) {
						console.log(items)
						start(items);// items: [{ text: text, value: value }]
					});
				} else
					start(getItemsByTerm(term));
			}
			else
				dropdown.hide();
		}

		function start(items) {
			if (items.length > 0) {
				// dropdown - configura e exibe
				setItems(items);
				showDropdown();
				setDropdownSize();
			} else
				dropdown.hide();

			loader("hide");
		}
	}

	function getItemsByTerm(term) {
		var
		_items = args.items,
		items = [];

		for (var i in _items) {
			var item = _items[i].text || _items[i];

			if (item.toLowerCase().match(term.toLowerCase()))
				items.push(_items[i]);
		}

		return items;
	}

	function setItems(items) {
		// itens
		if (items.length > 0) {
			// limpa
			dropdown.html("");
			args.itemWidth = 0;

			// carrega
			for (var i in items) {
				var
				text = items[i].text || items[i],
				value = items[i].value || text,
				item = itemTemplate.clone(); // clona o item template

				// valores
				item
				.text(text)
				.attr({
					value: value,
					text: text
				});

				// evento - click
				item[0].onclick = function() {
					selectItem($(this));
				};

				dropdown.append(item);

				// largura do dropdown
				if (text.length > args.itemWidth)
					args.itemWidth = text.length;
			}
		}
	}

	function showDropdown() {
		// insere o dropdown após o campo
		field.after(dropdown);

		// exibe
		dropdown
		.css({
			"display": "inline-block"
		})
		.scrollTop(0);
	}

	function dropdownIsOpen() {
		return (dropdown.css("display") !== "none");
	}

	function setDropdownSize() {
		// altura
		dropdown.height(args.itemHeight * args.dropdownHeight);

		// largura
		dropdown.width("");

		if (dropdown.width() < field.width())
			dropdown.width(field.width() + 2);
		else
			dropdown.width(dropdown.width() + 20);
	}

	function closeDropdown(item) {
		// oculta
		dropdown.hide();
		loader("hide");

		// callback
		if (item && args.selectItem) {
			args.selectItem({
				text: item.attr("text"),
				value: item.attr("value"),
				args: args
			});
		}
	}

	function cancel() {
		var
		eventType = window.event.type,
		srcElement = window.event.srcElement;

		// não cancela se o target for o próprio campo
		if ($(srcElement).attr("acid") === acid && eventType === "mousedown") {
			return false;
		} else {
			if (eventType !== "blur") {
				// restaura o valor original
				if (!args.allowAnyValue)
					restoreValue();

				// fecha o dropdown
				closeDropdown();
			}
		}
	}

	function selectItem(item) {
		// seleciona o item, atualiza o campo e fecha o dropdown

		// atualiza o valor do campo
		field.val(item.text());

		// atualiza o atributo originalvalue do campo
		field.attr("originalvalue", item.text());

		// fecha
		closeDropdown(item);
	}

	function detachItem(item) {
		// destaca o item
		item.attr({
			"detached": true,
			"class": "autocomplete-dropdown-item-selected"
		});

		// remove o destaque do anterior e próximo
		$([item.prev()[0], item.next()[0]]).attr({
			"detached": false,
			"class": "autocomplete-dropdown-item"
		});
	}

	function loader(state) {
		// exibe/oculta o icone animado

		if (state === "show")
			icon.attr("src", AC_ELEMENT.iconImage.loader);
		else
			icon.attr("src", AC_ELEMENT.iconImage.search);
	}

	function restoreValue() {
		// restaura o valor original do campo se diferente de vazio

		if ($.trim(field.val()).length > 0)
			field.val(field.attr("originalvalue"));
	}

	return args;
}