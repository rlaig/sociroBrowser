/**
 * UI/Components/Inventory/InventoryV2/InventoryV2.js
 *
 * Chararacter Inventory Window
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 * In some cases the client will send packet twice.eg NORMAL_ITEMLIST4; fixit [skybook888]
 *
 */
define(function(require)
{
	'use strict';


	/**
	 * Dependencies
	 */
	var DB                 = require('DB/DBManager');
	var ItemType           = require('DB/Items/ItemType');
	var Network            = require('Network/NetworkManager');
	var PACKET             = require('Network/PacketStructure');
	var jQuery             = require('Utils/jquery');
	var Client             = require('Core/Client');
	var Preferences        = require('Core/Preferences');
	var Renderer           = require('Renderer/Renderer');
	var Mouse              = require('Controls/MouseEventHandler');
	var UIManager          = require('UI/UIManager');
	var UIComponent        = require('UI/UIComponent');
	var CartItems          = require('UI/Components/CartItems/CartItems');
	var InputBox           = require('UI/Components/InputBox/InputBox');
	var ItemCompare        = require('UI/Components/ItemCompare/ItemCompare');
	var ItemInfo           = require('UI/Components/ItemInfo/ItemInfo');
	var ChatBox      	   = require('UI/Components/ChatBox/ChatBox');
	var Equipment          = require('UI/Components/Equipment/Equipment');
	var Storage   	       = require('UI/Components/Storage/Storage');
	var SwitchEquip        = require('UI/Components/SwitchEquip/SwitchEquip');
	var UIVersionManager   = require('UI/UIVersionManager');
	var htmlText           = require('text!./InventoryV2.html');
	var cssText            = require('text!./InventoryV2.css');
	var getModule          = require;


	/**
	 * Create Component
	 */
	var InventoryV2 = new UIComponent( 'InventoryV2', htmlText, cssText );


	/**
	 * Tab constant
	 */
	InventoryV2.TAB = {
		USABLE: 0,
		EQUIP:  1,
		ETC:    2,
		FAV:	3
	};


	/**
	 * Store inventory items
	 */
	InventoryV2.list = [];


	/**
	 * Store switch equip items
	 */
	InventoryV2.equipswitchlist = [];


	/**
	 * Store new items
	 */
	InventoryV2.newItems = [];
	InventoryV2.equippedItems = [];


	/**
	 * @var {number} used to remember the window height
	 */
	var _realSize = 0;


	/**
	 * @var {Preferences} structure
	 */
	var _preferences = Preferences.get('InventoryV2', {
		x:        0,
		y:        UIVersionManager.getInventoryVersion() > 0 ? 172 : 120,
		width:    7,
		height:   193,
		show:     false,
		reduce:   false,
		tab:      InventoryV2.TAB.USABLE,
		itemlock:	false,
		itemcomp:	false,
		npcsalelock:	false,
		magnet_top: false,
		magnet_bottom: false,
		magnet_left: true,
		magnet_right: false
	}, 1.0);


	/**
	 * Store variables from preferences
	 */
	InventoryV2.itemlock = _preferences.itemlock;
	InventoryV2.itemcomp = _preferences.itemcomp;
	InventoryV2.npcsalelock = _preferences.npcsalelock;
	var lockOverlayTimeout;


	/**
	 * Initialize UI
	 */
	InventoryV2.init = function Init()
	{
		// Bind buttons
		this.ui.find('.titlebar .base').mousedown(stopPropagation);
		this.ui.find('.titlebar .mini').click(onToggleReduction);
		this.ui.find('.tabs button').mousedown(onSwitchTab);
		this.ui.find('.footer .extend').mousedown(onResize);
		this.ui.find('.titlebar .close').click(function(){
			InventoryV2.ui.hide();
		});

		// on drop item
		this.ui
			.on('drop',     onDrop)
			.on('dragover', stopPropagation)

		// Items event
			.find('.container .content')
				.on('mousewheel DOMMouseScroll', onScroll)
				.on('mouseover',   '.item', onItemOver)
				.on('mouseout',    '.item', onItemOut)
				.on('dragstart',   '.item', onItemDragStart)
				.on('dragend',     '.item', onItemDragEnd)
				.on('contextmenu', '.item', onItemInfo)
				.on('dblclick',    '.item', onItemUsed);

		this.ui.find('.ncnt').text(0 + ' / ');
		this.ui.find('.mcnt').text(100);

		this.draggable(this.ui.find('.titlebar'));

		// Add drop events for tabs
		this.ui.find('.tabs button').on('dragover', stopPropagation).on('drop', onTabDrop);

		// Set initial selected tab based on _preferences.tab
		jQuery('.tabs button').removeClass('selected');
		var initialTab = this.ui.find('.tabs button').eq(_preferences.tab);
		initialTab.addClass('selected');

		// Buttons
		var lockImg = _preferences.itemlock ? 'inventory/item_drop_lock_on.bmp' : 'inventory/item_drop_lock_off.bmp' ;
		Client.loadFile(DB.INTERFACE_PATH + lockImg, function (data) {
			InventoryV2.ui.find('.item_drop_lock').css('backgroundImage', 'url(' + data + ')');
		});

		var compImg = _preferences.itemcomp ? 'inventory/item_compare_on.bmp' : 'inventory/item_compare_off.bmp' ;
		Client.loadFile(DB.INTERFACE_PATH + compImg, function (data) {
			InventoryV2.ui.find('.item_compare').css('backgroundImage', 'url(' + data + ')');
		});

		var lockSale = _preferences.npcsalelock ? InventoryV2.ui.find('.deallock_on') : InventoryV2.ui.find('.deallock_off');
		if (_preferences.tab != InventoryV2.TAB.FAV) {
			lockSale.hide();
			InventoryV2.ui.find('.sort').hide();
		} else {
			lockSale.show();
			InventoryV2.ui.find('.sort').show();
		}

		// Button Functions
		InventoryV2.ui.find('.item_drop_lock').click(onItemLock);
		InventoryV2.ui.find('.item_compare').click(onItemCompare);
		InventoryV2.ui.find('.deal_lock').click(onNPCLock);
		InventoryV2.ui.find('.lockoverlayclose').click(function(){
			InventoryV2.ui.find('.lockoverlaymsg').hide();
			clearTimeout(lockOverlayTimeout);
		});
		InventoryV2.ui.find('.sort').click( function(){ requestFilter();} );
	};


	/**
	 * Apply preferences once append to body
	 */
	InventoryV2.onAppend = function OnAppend()
	{
		// Apply preferences
		if (!_preferences.show) {
			this.ui.hide();
		}

		this.resize( _preferences.width, _preferences.height );

		this.ui.css({
			top:  Math.min( Math.max( 0, _preferences.y), Renderer.height - this.ui.height()),
			left: Math.min( Math.max( 0, _preferences.x), Renderer.width  - this.ui.width())
		});

		this.magnet.TOP = _preferences.magnet_top;
		this.magnet.BOTTOM = _preferences.magnet_bottom;
		this.magnet.LEFT = _preferences.magnet_left;
		this.magnet.RIGHT = _preferences.magnet_right;

		_realSize = _preferences.reduce ? 0 : this.ui.height();
		this.ui.find('.titlebar .mini').trigger('mousedown');
	};


	/**
	 * Remove Inventory from window (and so clean up items)
	 */
	InventoryV2.onRemove = function OnRemove()
	{
		this.ui.find('.container .content').empty();
		this.list.length = 0;
		this.equipswitchlist.length = 0; // Clear the equipswitchlist array
		InventoryV2.newItems.length = 0; // Clear the new items array
		jQuery('.ItemInfo').remove();

		// Save preferences
		_preferences.show   =  this.ui.is(':visible');
		_preferences.reduce = !!_realSize;
		_preferences.y      =  parseInt(this.ui.css('top'), 10);
		_preferences.x      =  parseInt(this.ui.css('left'), 10);
		_preferences.width  =  Math.floor( (this.ui.width()  - (23 + 16 + 16 - 30)) / 32 );
		_preferences.magnet_top = this.magnet.TOP;
		_preferences.magnet_bottom = this.magnet.BOTTOM;
		_preferences.magnet_left = this.magnet.LEFT;
		_preferences.magnet_right = this.magnet.RIGHT;
		_preferences.itemlock = _preferences.itemlock;
		_preferences.itemcomp = _preferences.itemcomp;
		_preferences.npcsalelock = _preferences.npcsalelock;
		_preferences.save();
	};


	/**
	 * Process shortcut
	 *
	 * @param {object} key
	 */
	InventoryV2.onShortCut = function onShurtCut( key )
	{
		switch (key.cmd) {
			case 'TOGGLE':
				this.ui.toggle();
				if (this.ui.is(':visible')) {
					this.focus();
				}
				else {
					// Chrome bug
					// when clicking double clicking an a weapon to equip
					// the item disapear, if you don't move the mouse and
					// triggered ALT+E then, the window disapear and you
					// can't trigger the scene anymore
					this.ui.trigger('mouseleave');
					this.clearNewItems(); // Clear new items
					this.ui.find('.new_item').css('backgroundImage', '');
				}
				break;
		}

		var BasicInfo = getModule('UI/Components/BasicInfo/BasicInfo');
		var changeUI = BasicInfo.getUI().ui.find('#item .btn_overlay');
		if (changeUI) { // Only applicable to BasicInfoV4 and BasicInfoV5
			changeUI.hide();
		}
	};


	/**
	 * Show/Hide UI
	 */
	InventoryV2.toggle = function toggle() {
		this.ui.toggle();
		if (this.ui.is(':visible')) {
			this.focus();
		} else {
			this.ui.trigger('mouseleave');
			this.clearNewItems(); // Clear new items
			this.ui.find('.new_item').css('backgroundImage', '');
		}

		var BasicInfo = getModule('UI/Components/BasicInfo/BasicInfo');
		var changeUI = BasicInfo.getUI().ui.find('#item .btn_overlay');
		if (changeUI) { // Only applicable to BasicInfoV4 and BasicInfoV5
			changeUI.hide();
		}
	};


	/**
	 * Clear newItems array
	 */
	InventoryV2.clearNewItems = function clearNewItems() {
	    this.newItems = [];
	};

	/**
	 * Extend inventory window size
	 *
	 * @param {number} width
	 * @param {number} height
	 */
	InventoryV2.resize = function Resize( width )
	{
		width  = Math.min( Math.max(width,  6), 8);

		this.ui.find('.container .content').css({
			width:  width  * 32 + 13, // 13 = scrollbar
		});

		this.ui.css({
			width:  23 + 16 + 16 + width  * 32,
		});
	};


	/**
	 * Get item object
	 *
	 * @param {number} id
	 * @returns {Item}
	 */
	InventoryV2.getItemById = function GetItemById( id )
	{
		var i, count;
		var list = InventoryV2.list;

		for (i = 0, count = list.length; i < count; ++i) {
			if (list[i].ITID === id) {
				return list[i];
			}
		}

		return null;
	};


	/**
	 * Search in a list for an item by its index
	 *
	 * @param {number} index
	 * @returns {Item}
	 */
	InventoryV2.getItemByIndex = function getItemByIndex( index )
	{
		var i, count;
		var list = InventoryV2.list;

		for (i = 0, count = list.length; i < count; ++i) {
			if (list[i].index === index) {
				return list[i];
			}
		}

		return null;
	};


	/**
	 * Add items to the list
	 * if the item index is exist you should clear it;[skybook888]
	 */
	InventoryV2.setItems = function SetItems(items)
	{
		var i, count;

		for (i = 0, count = items.length; i < count ; ++i) {
			var object= this.getItemByIndex(items[i].index);
			if(object){
				var item=this.removeItem(object.index,object.count);
			}
			if(this.addItemSub(items[i])){
				this.list.push(items[i]);
				this.ui.find('.ncnt').text(this.list.length + Equipment.getUI().getNumber() + ' / ');
				this.onUpdateItem(items[i].ITID, items[i].count ? items[i].count : 1);
			}


		}

	};


	/**
	 * Insert Item to inventory
	 *
	 * @param {object} Item
	 */
	InventoryV2.addItem = function AddItem( item )
	{
		var object = this.getItemByIndex(item.index);

		// Check if the item was equipped
		var equippedIndex = InventoryV2.equippedItems.indexOf(item.index);
		if (equippedIndex !== -1) {
		    // Remove from equipped tracker
		    InventoryV2.equippedItems.splice(equippedIndex, 1);
		} else {
		    // Mark as new item
		    InventoryV2.newItems.push(item.index);

			var BasicInfo = getModule('UI/Components/BasicInfo/BasicInfo');
			var changeUI = BasicInfo.getUI().ui.find('#item .btn_overlay');
			if (changeUI) { // Only applicable to BasicInfoV4 and BasicInfoV5
				changeUI.show();
			}
		}

		if (object) {
			// Handle NaN values (equips)
			if (isNaN(object.count)) {
				object.count = 1;
			}
			if (isNaN(item.count)) {
				item.count = 1;
			}
			object.count += item.count;
			this.ui.find('.item[data-index="'+ item.index +'"] .count').text( object.count );
			this.onUpdateItem(object.ITID, object.count);
			// Replace the existing index in newItems to maintain it as new
			var indexPosition = InventoryV2.newItems.indexOf(item.index);
			if (indexPosition !== -1) {
				InventoryV2.newItems.splice(indexPosition, 1, item.index);
			} else {
				InventoryV2.newItems.push(item.index);
			}
			onAddNewItem();
			return;
		}

		object = jQuery.extend({}, item);
		if (this.addItemSub(object)) {
			this.list.push(object);
			this.ui.find('.ncnt').text(this.list.length + Equipment.getUI().getNumber() + ' / ');
			this.onUpdateItem(object.ITID, object.count);
		}

		function onAddNewItem() {
			var tab;
			switch (item.type) {
				case ItemType.HEALING:
				case ItemType.USABLE:
				case ItemType.DELAYCONSUME:
				case ItemType.CASH:
					tab = InventoryV2.TAB.USABLE;
					break;

				case ItemType.WEAPON:
				case ItemType.ARMOR:
				case ItemType.SHADOWGEAR:
				case ItemType.PETEGG:
				case ItemType.PETARMOR:
					tab = InventoryV2.TAB.EQUIP;
					break;

				default:
				case ItemType.ETC:
				case ItemType.CARD:
				case ItemType.AMMO:
					tab = InventoryV2.TAB.ETC;
					break;
			}

			if (tab === _preferences.tab) {
				Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/new_item.bmp', function (data) {
        	        InventoryV2.ui.find('.item[data-index="'+ item.index +'"] .new_item').css('backgroundImage', 'url(' + data + ')');
        	    });
			}
		}

	};


	/**
	 * Check if item index is in newItems list
	 *
	 * @param {number} index - Item index to check
	 * @returns {boolean} - True if item index is in newItems list, false otherwise
	 */
	InventoryV2.isNewItem = function isNewItem(index) {
	    return InventoryV2.newItems.includes(index);
	};


	/**
	 * Add item to inventory
	 *
	 * @param {object} Item
	 */
	InventoryV2.addItemSub = function AddItemSub( item )
	{
		var tab;
		switch (item.type) {
			case ItemType.HEALING:
			case ItemType.USABLE:
			case ItemType.DELAYCONSUME:
			case ItemType.CASH:
				tab = InventoryV2.TAB.USABLE;
				break;

			case ItemType.WEAPON:
			case ItemType.ARMOR:
			case ItemType.SHADOWGEAR:
			case ItemType.PETEGG:
			case ItemType.PETARMOR:
				tab = InventoryV2.TAB.EQUIP;
				break;

			default:
			case ItemType.ETC:
			case ItemType.CARD:
			case ItemType.AMMO:
				tab = InventoryV2.TAB.ETC;
				break;
		}

		if (item.PlaceETCTab) {
			tab  = InventoryV2.TAB.FAV;
		}

		// Equip item (if not arrow)
		if (item.WearState && item.type !== ItemType.AMMO && item.type !== ItemType.CARD) {
			Equipment.getUI().equip(item, item.WearState);
			return false;
		}

		if (tab === _preferences.tab) {
			var it      = DB.getItemInfo( item.ITID );
			var content = this.ui.find('.container .content');

			content.append(
				'<div class="item" data-index="'+ item.index +'" draggable="true">' +
					'<div class="new_item"></div>' +
					'<div class="icon"></div>' +
					'<div class="switch1"></div>' +
					'<div class="switch2"></div>' +
					'<div class="amount"><span class="count">' + (item.count || 1) + '</span></div>' +
				'</div>'
			);

			if (content.height() < content[0].scrollHeight) {
				this.ui.find('.hide').hide();
			}
			else {
				this.ui.find('.hide').show();
			}

			Client.loadFile( DB.INTERFACE_PATH + 'item/' + ( item.IsIdentified ? it.identifiedResourceName : it.unidentifiedResourceName ) + '.bmp', function(data){
				content.find('.item[data-index="'+ item.index +'"] .icon').css('backgroundImage', 'url('+ data +')');
			});

			if (InventoryV2.isNewItem(item.index)) {
				Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/new_item.bmp', function (data) {
            	    content.find('.item[data-index="'+ item.index +'"] .new_item').css('backgroundImage', 'url(' + data + ')');
            	});
			} else {
				content.find('.item[data-index="'+ item.index +'"] .new_item').css('backgroundImage', '');
			}

			// Check if the item is in the equipswitchlist
			var isInEquipSwitchList = InventoryV2.equipswitchlist.some(function(equipItem) {
				return equipItem.index === item.index;
			});

			if (isInEquipSwitchList) {
				SwitchEquip.equip(item, item.location, true);

				Client.loadFile(DB.INTERFACE_PATH + 'swap_equipment/bg_change.bmp', function(data){
					content.find('.item[data-index="'+ item.index +'"] .switch1').css('backgroundImage', 'url('+ data +')');
				});
				Client.loadFile(DB.INTERFACE_PATH + 'swap_equipment/ico_change.bmp', function(data){
					content.find('.item[data-index="'+ item.index +'"] .switch2').css('backgroundImage', 'url('+ data +')');
				});
			}

		}

		// Check if the item is in the equipswitchlist
		var isInEquipSwitchList = InventoryV2.equipswitchlist.some(function(equipItem) {
			return equipItem.index === item.index;
		});

		if (isInEquipSwitchList) {
			SwitchEquip.equip(item, item.location, true);
		}

		return true;
	};


	/**
	 * Check if an item with the given location exists in the equip switch list.
	 *
	 * @param {number} location - The location of the item to check.
	 * @returns {boolean} True if the item exists in the equip switch list, false otherwise.
	 */
	InventoryV2.isInEquipSwitchList = function(location) {
		return this.equipswitchlist.some(function(existingItem) {
			return (existingItem.location & location) !== 0;
		});
	};


	/**
	 * Remove item from inventory
	 *
	 * @param {number} index in inventory
	 * @param {number} count
	 */
	InventoryV2.removeItem = function RemoveItem( index, count )
	{
		var item = this.getItemByIndex(index);

		// Emulator failed to complete the operation
		// do not remove item from inventory
		if (!item || count <= 0) {
			return null;
		}

		if (item.count) {
			item.count -= count;

			if (item.count > 0) {
				this.ui.find('.item[data-index="'+ item.index +'"] .count').text( item.count );
				this.onUpdateItem(item.ITID, item.count);
				return item;
			}
		}

		this.list.splice( this.list.indexOf(item), 1 );
		this.ui.find('.item[data-index="'+ item.index +'"]').remove();
		this.ui.find('.ncnt').text(this.list.length + Equipment.getUI().getNumber() + ' / ');
		this.onUpdateItem(item.ITID, 0);

		var content = this.ui.find('.container .content');
		if (content.height() === content[0].scrollHeight) {
			this.ui.find('.hide').show();
		}

		return item;
	};


	/**
	 * Remove item from inventory
	 *
	 * @param {number} index in inventory
	 * @param {number} count
	 */
	InventoryV2.updateItem = function UpdateItem( index, count )
	{
		var item = this.getItemByIndex(index);

		if (!item) {
			return;
		}

		item.count = count;

		// Update quantity
		if (item.count > 0) {
			this.ui.find('.item[data-index="'+ item.index +'"] .count').text( item.count );
			this.onUpdateItem(item.ITID, item.count);
			return;
		}

		// no quantity, remove
		this.list.splice( this.list.indexOf(item), 1 );
		this.ui.find('.item[data-index="'+ item.index +'"]').remove();
		this.ui.find('.ncnt').text(this.list.length + Equipment.getUI().getNumber() + ' / ');
		this.onUpdateItem(item.ITID, 0);

		var content = this.ui.find('.container .content');
		if (content.height() === content[0].scrollHeight) {
			this.ui.find('.hide').show();
		}
	};


	/**
	 * Use an item
	 *
	 * @param {Item} item
	 */
	InventoryV2.useItem = function UseItem( item )
	{
		switch (item.type) {

			// Usable item
			case ItemType.HEALING:
			case ItemType.USABLE:
			case ItemType.CASH:
				InventoryV2.onUseItem( item.index );
				break;

			// Use card
			case ItemType.CARD:
				InventoryV2.onUseCard( item.index );
				break;

			case ItemType.DELAYCONSUME:
				break;

			// Equip item
			case ItemType.WEAPON:
			case ItemType.ARMOR:
			case ItemType.SHADOWGEAR:
			case ItemType.PETARMOR:
			case ItemType.AMMO:
				if (item.IsIdentified && !item.IsDamaged) {
					InventoryV2.onEquipItem( item.index, item.location );
				}
				break;
		}

		return;
	};


	/**
	 * Stop event propagation
	 */
	function stopPropagation( event )
	{
		event.stopImmediatePropagation();
		return false;
	};


	/**
	 * Extend inventory window size
	 */
	function onResize()
	{
		var ui      = InventoryV2.ui;
		var content = ui.find('.container .content');
		var hide    = ui.find('.hide');
		var top     = ui.position().top;
		var left    = ui.position().left;
		var lastWidth  = 0;
		var _Interval;

		function resizing()
		{
			var extraX = 23 + 16 + 16 - 30;

			var w = Math.floor( (Mouse.screen.x - left - extraX) / 32 );

			// Maximum and minimum window size
			w = Math.min( Math.max(w, 6), 9);

			if (w === lastWidth) {
				return;
			}

			InventoryV2.resize(w);
			lastWidth  = w;

			//Show or hide scrollbar
			if (content.height() === content[0].scrollHeight) {
				hide.show();
			}
			else {
				hide.hide();
			}
		}

		// Start resizing
		_Interval = setInterval( resizing, 30);

		// Stop resizing on left click
		jQuery(window).on('mouseup.resize', function(event){
			if (event.which === 1) {
				clearInterval(_Interval);
				jQuery(window).off('mouseup.resize');
			}
		});
	};


	/**
	 * Modify tab, filter display entries
	 */
	function onSwitchTab()
	{
		var idx          = jQuery(this).index();
		_preferences.tab = parseInt(idx, 10);
		requestFilter();

		jQuery('.tabs button').removeClass('selected');
    	jQuery(this).addClass('selected');

		// Toggle visibility based on tab selection and npc sale lock preference
		if (_preferences.tab !== InventoryV2.TAB.FAV) {
			InventoryV2.ui.find('.deallock_on').hide();
			InventoryV2.ui.find('.deallock_off').hide();
			InventoryV2.ui.find('.lockoverlay').hide();
			InventoryV2.ui.find('.lockoverlaymsg').hide();
			InventoryV2.ui.find('.sort').hide();
		} else {
			if (_preferences.npcsalelock) {
				InventoryV2.ui.find('.deallock_on').show();
				InventoryV2.ui.find('.lockoverlay').show();
				InventoryV2.ui.find('.deallock_off').hide();
			} else {
				InventoryV2.ui.find('.deallock_on').hide();
				InventoryV2.ui.find('.lockoverlay').hide();
				InventoryV2.ui.find('.lockoverlaymsg').hide();
				InventoryV2.ui.find('.deallock_off').show();
			}
			InventoryV2.ui.find('.sort').show();
		}
	};


	/**
	 * Hide/show inventory's content
	 */
	function onToggleReduction()
	{
		var ui = InventoryV2.ui;

		if (_realSize) {
			ui.find('.panel').show();
			ui.height(_realSize);
			_realSize = 0;
		}
		else {
			_realSize = ui.height();
			ui.height(17);
			ui.find('.panel').hide();
		}
	};


	/**
	 * Update tab, reset inventory content
	 */
	function requestFilter()
	{
		InventoryV2.ui.find('.container .content').empty();

		var list = InventoryV2.list;
		var i, count;

		for (i = 0, count = list.length; i < count; ++i) {
			InventoryV2.addItemSub( list[i] );
		}
	};


	/**
	 * Drop an item from storage to inventory
	 *
	 * @param {event}
	 */
	function onDrop( event )
	{
		var item, data;
		event.stopImmediatePropagation();

		try {
			data = JSON.parse(event.originalEvent.dataTransfer.getData('Text'));
			item = data.data;
		}
		catch(e) {
			return false;
		}

		// Just allow item from storage
		if (data.type !== 'item' || (data.from !== 'Storage' && data.from !== 'CartItems' && data.from !== 'Mail' && data.from !== 'WriteRodex')) {
			return false;
		}

		// Have to specify how much
		if (item.count > 1)
		{
			InputBox.append();
			InputBox.setType('number', false, item.count);

			InputBox.onSubmitRequest = function OnSubmitRequest( count )
			{
				InputBox.remove();

					switch(data.from)
					{
					case 'Storage':
						getModule('UI/Components/Storage/Storage').reqRemoveItem(
							item.index,
							parseInt(count, 10 )
							);
						break;

					case 'CartItems':
						getModule('UI/Components/CartItems/CartItems').reqRemoveItem(
							item.index,
							parseInt(count, 10 )
							);
						break;

					case 'Mail':
						getModule('UI/Components/Mail/Mail').reqRemoveItem(
							item.index,
							parseInt(count, 10 )
							);
						break;

					case 'WriteRodex':
						getModule('UI/Components/Rodex/WriteRodex').requestRemoveItemRodex(
							item.index,
							parseInt(count, 10 )
							);
						break;

					}
			};
			return false;
		}

		switch(data.from)
		{
			case 'Storage':
				getModule('UI/Components/Storage/Storage').reqRemoveItem( item.index, 1 );
				break;

			case 'CartItems':
				getModule('UI/Components/CartItems/CartItems').reqRemoveItem( item.index, 1 );
				break;

			case 'Mail':
				getModule('UI/Components/Mail/Mail').reqRemoveItem( item.index, 1 );
				break;

			case 'WriteRodex':
				getModule('UI/Components/Rodex/WriteRodex').requestRemoveItemRodex( item.index, 1 );
				break;
		}

		return false;
	};


	/**
	 * Block the scroll to move 32px at each move
	 */
	function onScroll( event )
	{
		var delta;

		if (event.originalEvent.wheelDelta) {
			delta = event.originalEvent.wheelDelta / 120 ;
			if (window.opera) {
				delta = -delta;
			}
		}
		else if (event.originalEvent.detail) {
			delta = -event.originalEvent.detail;
		}

		this.scrollTop = Math.floor(this.scrollTop/32) * 32 - (delta * 32);
		event.stopImmediatePropagation();
		return false;
	};


	/**
	 * Show item name when mouse is over
	 */
	function onItemOver()
	{
		var idx  = parseInt( this.getAttribute('data-index'), 10);
		var item = InventoryV2.getItemByIndex(idx);

		if (!item) {
			return;
		}

		let quantity = ' ea';
		if (item.Options && (item.type === ItemType.WEAPON || item.type === ItemType.ARMOR || item.type === ItemType.SHADOWGEAR) &&
			item.Options.filter(Option => Option.index !== 0).length > 0)
		{
			quantity = ' Quantity';
		}

		// Get back data
		var pos     = jQuery(this).position();
		var overlay = InventoryV2.ui.find('.overlay');

		// Display box
		overlay.show();
		overlay.css({top: pos.top, left:pos.left+35});
		overlay.text(DB.getItemName(item) + ': ' + (item.count || 1) + quantity);

		if (item.IsIdentified) {
			overlay.removeClass('grey');
		}
		else {
			overlay.addClass('grey');
		}
	};


	/**
	 * Hide the item name
	 */
	function onItemOut()
	{
		InventoryV2.ui.find('.overlay').hide();
	};


	/**
	 * Start dragging an item
	 */
	function onItemDragStart( event )
	{
		var index = parseInt(this.getAttribute('data-index'), 10);
		var item  = InventoryV2.getItemByIndex(index);

		if (!item) {
			return;
		}

		// Set image to the drag drop element
		var img   = new Image();
		var url = this.querySelector('.icon').style.backgroundImage.match(/\((.*?)\)/)[1].replace(/('|")/g,'');
		img.src   = url.replace(/^\"/, '').replace(/\"$/, '');

		event.originalEvent.dataTransfer.setDragImage( img, 12, 12 );
		event.originalEvent.dataTransfer.setData('Text',
			JSON.stringify( window._OBJ_DRAG_ = {
				type: 'item',
				from: 'Inventory',
				data:  item
			})
		);

		onItemOut();
	};


	/**
	 * Stop dragging an item
	 *
	 */
	function onItemDragEnd()
	{
		delete window._OBJ_DRAG_;
	};


	/**
	 * Get item info (open description window)
	 */
	function onItemInfo( event )
	{
		event.stopImmediatePropagation();

		var index = parseInt(this.getAttribute('data-index'), 10);
		var item  = InventoryV2.getItemByIndex(index);

		if (!item) {
			return false;
		}

		// If right click w/ alt (Request Transfer Item)
		if (event.altKey && event.which === 3) {
			event.stopImmediatePropagation();
			transferItemToOtherUI(item);
			return false;
		}

		// Don't add the same UI twice, remove it
		if (ItemInfo.uid === item.ITID) {
			ItemInfo.remove();
			if (ItemCompare.ui) {
				ItemCompare.remove();
			}
			return false;
		}

		// Remove existing compare UI if it's currently displayed
		if (ItemCompare.ui) {
			ItemCompare.remove();
		}

		// Add ui to window
		ItemInfo.append();
		ItemInfo.uid = item.ITID;
		ItemInfo.setItem(item);

		// Check if there is an equipped item in the same location
		var compareItem = Equipment.getUI().isInEquipList(item.location);

		// If a comparison item is found, display comparison
		if (compareItem && InventoryV2.itemcomp) {
			ItemCompare.prepare();
			ItemCompare.append();
			ItemCompare.uid = compareItem.ITID;
			ItemCompare.setItem(compareItem);
		}

		return false;
	};


	/**
	 * Alt Right Click Request Transfer
	 */
	function transferItemToOtherUI(item)
	{
		var isStorageOpen = Storage.ui ? Storage.ui.is(':visible') : false;
		var isCartOpen = CartItems.ui ? CartItems.ui.is(':visible') : false;

		if (!item) {
			return false;
		}

		var count = item.count || 1;

		if (isStorageOpen) {
			Storage.reqAddItem(item.index, count);
		} else if (isCartOpen) {
			InventoryV2.reqMoveItemToCart(item.index, count);
		}

		return true;
	};


	/**
	 * Ask to use an item
	 */
	function onItemUsed( event )
	{
		var index = parseInt(this.getAttribute('data-index'), 10);
		var item  = InventoryV2.getItemByIndex(index);

		if (item) {
			InventoryV2.useItem(item);
			onItemOut();
		}

		event.stopImmediatePropagation();
		return false;
	};


	/**
	 * Handle drop event on tabs
	 */
	function onTabDrop(event)
	{
	    var item, data;
		event.stopImmediatePropagation();

		try {
			data = JSON.parse(event.originalEvent.dataTransfer.getData('Text'));
			item = data.data;
		}
		catch(e) {
			return false;
		}

		if (data.type !== 'item') {
			return false;
		}

		if (!item) {
			return false;
		}

	    // Retrieve the data-tab attribute using native JavaScript
    	var targetTab = event.target.getAttribute('data-tab');
		var itemfav = (targetTab === 'fav' ? 0 : 1);

		// Send Request to client
		var pkt = new PACKET.CZ.INVENTORY_TAB();
		pkt.item_index = item.index;
		pkt.favorite = itemfav;
		Network.sendPacket(pkt);
	};


	/**
	 * Update PlaceETCTab of an item in the inventory
	 * @param {number} itemIndex - The index of the item to update
	 * @param {number} newValue - boolean for PlaceETCTab (1 or 0)
	 */
	InventoryV2.updatePlaceETCTab = function(itemIndex, newValue)
	{
		var item = InventoryV2.getItemByIndex(itemIndex);

		if (!item) {
			return;
		}

		if (newValue) {
			var favoriteval;
			switch (item.type) {
				case ItemType.HEALING:
				case ItemType.USABLE:
				case ItemType.DELAYCONSUME:
				case ItemType.CASH:
				case ItemType.ETC:
				case ItemType.CARD:
				case ItemType.AMMO:
					// Normal items: PlaceETCTab = flag & 2;
					favoriteval = 2;
					break;

				case ItemType.WEAPON:
				case ItemType.ARMOR:
				case ItemType.SHADOWGEAR:
				case ItemType.PETEGG:
				case ItemType.PETARMOR:
					// Equipment: PlaceETCTab = flag & 4;
					favoriteval = 4;
					break;

				default:
					break;
			}
			item.PlaceETCTab = favoriteval;
		} else {
			item.PlaceETCTab = newValue;
		}

	    requestFilter();
	};


	/**
	 * Toggle the item drop lock preference and update the UI accordingly.
	 */
	function onItemLock()
	{
		// Toggle _preferences.itemlock
		_preferences.itemlock = !_preferences.itemlock;

		// Save it
		InventoryV2.itemlock = _preferences.itemlock;

		// Determine the image path based on the toggled state
		var lockImg = _preferences.itemlock ? 'inventory/item_drop_lock_on.bmp' : 'inventory/item_drop_lock_off.bmp';

		// Load the image and update the button background
		Client.loadFile(DB.INTERFACE_PATH + lockImg, function (data) {
			InventoryV2.ui.find('.item_drop_lock').css('backgroundImage', 'url(' + data + ')');
		});
	};


	/**
	 * Toggles the value of Item Compare
	 * and updates the UI accordingly.
	 */
	function onItemCompare()
	{
		// Toggle _preferences.itemcomp
		_preferences.itemcomp = !_preferences.itemcomp;

		// Save it
		InventoryV2.itemcomp = _preferences.itemcomp;

		// Determine the image path based on the toggled state
		var compImg = _preferences.itemcomp ? 'inventory/item_compare_on.bmp' : 'inventory/item_compare_off.bmp' ;

		// Load the image and update the button background
		Client.loadFile(DB.INTERFACE_PATH + compImg, function (data) {
			InventoryV2.ui.find('.item_compare').css('backgroundImage', 'url(' + data + ')');
		});
	};


	/**
	 * Toggles the value of Item Lock NPCSale
	 * and updates the UI accordingly.
	 */
	function onNPCLock()
	{
		// Toggle _preferences.npcsalelock
		_preferences.npcsalelock = !_preferences.npcsalelock;

		// Save it
		InventoryV2.npcsalelock = _preferences.npcsalelock;

		// Determine which div to show/hide based on the toggled state
		if (_preferences.npcsalelock) {
			InventoryV2.ui.find('.deallock_on').show();
			InventoryV2.ui.find('.lockoverlay').show();
			InventoryV2.ui.find('.lockoverlaymsg').show();
			InventoryV2.ui.find('.deallock_off').hide();

			// Show for 3 seconds
            lockOverlayTimeout = setTimeout(function() {
                InventoryV2.ui.find('.lockoverlaymsg').fadeOut();
            }, 3000);
		} else {
			InventoryV2.ui.find('.deallock_on').hide();
			InventoryV2.ui.find('.lockoverlay').hide();
            InventoryV2.ui.find('.lockoverlaymsg').hide();
			InventoryV2.ui.find('.deallock_off').show();
		}
	};


	/**
	 * Add an item to the equip switch list, handling duplicates and updating UI.
	 *
	 * @param {number} index - The index of the item to add
	 */
	InventoryV2.addItemtoSwitch = function(index) {
		var item = this.getItemByIndex(index);
		if (!item) {
			console.warn("Item with index " + index + " not found in inventory.");
			return;
		}

		// Check if an item with the same location already exists
		var existingItemIndex = this.equipswitchlist.findIndex(function(existingItem) {
			return existingItem.location === item.location;
		});

		// If an item with the same location exists, unequip it and remove it from the list
		if (existingItemIndex > -1) {
			var existingItem = this.equipswitchlist[existingItemIndex];
			SwitchEquip.unEquip(existingItem.index, existingItem.location);
			this.equipswitchlist.splice(existingItemIndex, 1);
		}

		// Add the new item to the list
		this.equipswitchlist.push(item);

		var content = this.ui.find('.container .content');
		Client.loadFile(DB.INTERFACE_PATH + 'swap_equipment/bg_change.bmp', function(data){
			content.find('.item[data-index="'+ item.index +'"] .switch1').css('backgroundImage', 'url('+ data +')');
		});
		Client.loadFile(DB.INTERFACE_PATH + 'swap_equipment/ico_change.bmp', function(data){
			content.find('.item[data-index="'+ item.index +'"] .switch2').css('backgroundImage', 'url('+ data +')');
		});

		SwitchEquip.equip(item, item.location, true);
		ChatBox.addText(
			DB.getItemName(item) + ' ' + DB.getMessage(3143),
			ChatBox.TYPE.BLUE,
			ChatBox.FILTER.ITEM
		);
	};


	/**
	 * Removes an item from the equip switch list and updates the UI accordingly.
	 *
	 * @param {number} index - The index of the item to remove.
	 */
	InventoryV2.removeItemFromSwitch = function(index) {
		var item = this.getItemByIndex(index);
    	if (!item) {
    	    console.warn("Item with index " + index + " not found in inventory.");
    	    return;
    	}

    	// Check if the item exists in the equip switch list
    	var existingItemIndex = this.equipswitchlist.findIndex(function(existingItem) {
    	    return existingItem.index === item.index;
    	});

    	if (existingItemIndex > -1) {

			var content = this.ui.find('.container .content');
    	    content.find('.item[data-index="'+ item.index +'"] .switch1').css('backgroundImage', 'none');
		    content.find('.item[data-index="'+ item.index +'"] .switch2').css('backgroundImage', 'none');

    	    SwitchEquip.unEquip(item.index, item.location);
			var removedItem = this.equipswitchlist.splice(existingItemIndex, 1)[0];

			ChatBox.addText(
				DB.getItemName(item) + ' ' + DB.getMessage(3144),
				ChatBox.TYPE.BLUE,
				ChatBox.FILTER.ITEM
			);

			// Manually equip-all equip items to SwitchEquip UI
			Equipment.getUI().equipItemsToSwitch();

			// Manually re-equip all items in the Switch List to SwitchEquip UI
			InventoryV2.equipAllFromSwitchList();
		}
	};


	/**
	 * Equip all items in the equip switch list
	 */
	InventoryV2.equipAllFromSwitchList = function equipAllFromSwitchList() {
	    var equipSwitchList = InventoryV2.equipswitchlist;

	    for (var i = 0; i < equipSwitchList.length; i++) {
	        var item = equipSwitchList[i];
	        if (item) {
	            SwitchEquip.equip(item, item.location, true);
	        }
	    }

	};


	/**
	 * functions to define
	 */
	InventoryV2.onUseItem    = function OnUseItem(/* index */){};
	InventoryV2.onUseCard    = function onUseCard(/* index */){};
	InventoryV2.onEquipItem  = function OnEquipItem(/* index, location */){};
	InventoryV2.onUpdateItem = function OnUpdateItem(/* index, amount */){};
	InventoryV2.reqMoveItemToCart = function reqMoveItemToCart(/* index, amount */){};

	/**
	 * Create component and export it
	 */
	return UIManager.addComponent(InventoryV2);

});
