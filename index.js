var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;

var STATE_CLOSED = 0;
var STATE_PREPARED = 1;
var STATE_OPENED = 2;


var isNavigationSet = false;

// history object

function NavTreeHistory(bindToNavigator) {
	EventEmitter.call(this);
	var self = this;

	this._nodes = [];
	this._index = -1;
	this._currentHash = 0;
	this._bindToNavigator = !!bindToNavigator;

	if (bindToNavigator && isNavigationSet) {
		return console.warn("The navigator is already bound to a NavTree");
	}

	if (bindToNavigator) {
		isNavigationSet = true;
		window.onhashchange = function () {

			if (self._lockHashUpdate) {
				self._lockHashUpdate = false;
				return;
			}

			var newHash = self._getLocationHash();

			if (newHash > self._currentHash) {
				self.emit('forward');
			} else {
				self.emit('backward');
			}
			self._currentHash = newHash;
		};
	}
}

inherits(NavTreeHistory, EventEmitter);

NavTreeHistory.prototype._moveTo = function (index) {
	this._index = index;
	this.emit('move', this._index, this._nodes[this._index]);
};


NavTreeHistory.prototype.current = function () {
	return this._nodes[this._index];	// undefined if the list is empty
};


NavTreeHistory.prototype.isEmpty = function () {
	return this._nodes.length === 0;
};


NavTreeHistory.prototype.clear = function () {
	this._nodes = [];
	this._moveTo(-1);
	this._currentHash = 0;
};


NavTreeHistory.prototype.clearPast = function () {
	if (this._index > 0) {
		this._nodes.splice(0, this._index);
		this._moveTo(0);
		this._currentHash = 0;
	}
};


NavTreeHistory.prototype.clearFuture = function () {
	this._nodes.splice(this._index + 1);
	this._currentHash = Date.now();
};


NavTreeHistory.prototype.resetToCurrent = function () {
	var node = this._nodes[this._index];

	if (node) {
		this._nodes = [node];
		this._moveTo(0);
	} else {
		this.clear();
	}
	this._currentHash = 0;
};


NavTreeHistory.prototype.add = function (node) {
	var index = this._index + 1;

	// drop all nodes starting at the new index, and add the node to the end

	this._nodes.splice(index, this._nodes.length, node);

	// increment the index

	this._moveTo(index);
	this._setLocationHash();
};


NavTreeHistory.prototype.replace = function (node, protectFuture) {
	var index = this._index;

	if (index < 0) {
		// if there were no elements before, we want to write to index 0

		index = 0;
	}

	if (protectFuture) {
		this._nodes[index] = node;
	} else {
		// drop all nodes starting at index, and add the node to the end

		this._nodes.splice(index, this._nodes.length, node);
	}

	this._moveTo(index);
};


/**
 * Returns the value of the location hash.
 * @return {string} Hash value with '#' prefix discarded.
 */
NavTreeHistory.prototype._getLocationHash = function () {
	return window.location.hash.substring(1);
};


/**
 * Updates the location hash with the specified string.
 */
NavTreeHistory.prototype._setLocationHash = function () {
	if (this._bindToNavigator) {
		this._currentHash = Date.now();
		this._lockHashUpdate = true;
		window.location.hash = this._currentHash;
	}
};


NavTreeHistory.prototype.back = function () {
	var index = this._index - 1;
	var node = this._nodes[index];

	if (index >= -1) {
		this._moveTo(index);

		if (node) {
			return node;
		}
	}

	// else undefined
};


NavTreeHistory.prototype.forward = function () {
	var index = this._index + 1;
	var node = this._nodes[index];

	if (node) {
		this._moveTo(index);

		return node;
	}

	// else undefined
};


/**
 * @class
 * @classDesc nav tree implementation
 * @param {Object} [options]
 * @param {Boolean} [options.createOnRegister=false]
 * @param {Boolean} [options.bindToNavigator=false]
 * @param {Object} [creationOptions]
 */
function NavTree(options, creationOptions) {
	EventEmitter.call(this);

	var self = this;
	this._tree = {};             // collection of objects to which we can navigate, indexed by name
	this._nodeQueue = [];        // FIFO
	this._options = options || {};
	this._creationOptions = creationOptions || {};
	this._opening = false;
	this._response = undefined;

	this._stack = new NavTreeHistory(this._options.bindToNavigator);

	if (!this._options.hasOwnProperty('createOnRegister')) {
		this._options.createOnRegister = false;
	}

	this._stack.on('forward', function () {
		self.forward();
	});

	this._stack.on('backward', function () {
		self.back();
	});

}


inherits(NavTree, EventEmitter);
module.exports = NavTree;

NavTree.prototype.register = function (name, item, options) {
	if (this._tree[name]) {
		return console.error('The name', name, 'is already used on the NavTree');
	}

	this._tree[name] = item;
	if (item.hasOwnProperty('navId')) {
		console.warn('The property `navId` already exist on the item');
	} else {
		item.navId = name;
	}

	this.rebindItem(item);

	options = options || {};
	if ((this._options.createOnRegister && options.create !== false) || options.create) {
		this._createItem(name);
	}
};


NavTree.prototype.getItem = function (name) {
	return this._tree[name];
};


NavTree.prototype.getOpenedItem = function () {
	var current = this._stack.current();
	return current && current.item;
};


NavTree.prototype._createNode = function (name, params, closeCb) {
	var item = this._tree[name];

	if (!item) {
		console.error('NavTree item', name, 'not found.');
		return null;
	}

	if (!item._isCreated) {
		this._createItem(name);
	}

	return {
		name: name,
		params: params,
		item: item,
		state: STATE_CLOSED,
		closeCb: closeCb
	};
};


NavTree.prototype.rebindItem = function (item) {
	var navTree = this;

	item.getNavTree = function () {
		return navTree;
	};
};


NavTree.prototype._createItem = function (name) {
	var item = this._tree[name];

	if (item.create) {
		item.create(this._creationOptions, name);
	}

	item._isCreated = true;
};


NavTree.prototype._closeNode = function (node, cb) {
	if (!node || node.state === STATE_CLOSED) {
		// only non-closed nodes can be closed
		return cb();
	}

	var self = this;
	function closeItemCb() {
		node.state = STATE_CLOSED;
		self.emit('close', node.name);

		if (node.closeCb) {
			node.closeCb(self._response);
			self._response = undefined;
			node.closeCb = null;
		}
		cb();
	}

	if (node.item.close) {
		// if the supplied close function has 2 arguments, we treat the second argument
		// as a callback function
		if (node.item.close.length === 2) {
			return node.item.close(node.item.params, closeItemCb);
		}

		node.item.close(node.item.params);
	}

	return closeItemCb();
};



NavTree.prototype._openNode = function (node) {
	// call the beforeopen event if the node wasn't prepared yet

	var replacement, replacementNode;

	if (node.state === STATE_CLOSED && node.item.beforeopen) {
		// replacement is an object { name: 'item name', params: { anything } }

		replacement = node.item.beforeopen(node.params);

		if (replacement) {
			replacementNode = this._createNode(replacement.name, replacement.params);
		}
	}

	// beforeopen event handlers could have injected a node, meaning we have to postpone opening this node

	if (replacementNode) {
		// enqueue the node (first in line), and tag it as prepared, since beforeopen() has been called

		node.state = STATE_PREPARED;

		this._nodeQueue.unshift(node);

		node = this._openNode(replacementNode);

	} else {
		// call item.open() and set the node state to opened.

		node.state = STATE_OPENED;

		this.rebindItem(node.item);

		node.item.open(node.params);

		this.emit('open', node.name, node.params);
	}

	this._opening = false;
	return node;
};


NavTree.prototype._transitionNodes = function (from, to, transition) {

	if (from && from.name === to.name) {
		from.item.emit('closing', from.params);
		from.item.emit('closed', from.params);
		from = null;
	}

	if (!from) {
		to.item.emit('opening', to.params);

		this._openNode(to);

		return window.setTimeout(function () {
			to.item.emit('opened', to.params);
		}, 0);
	}

	var self = this;

	from.item.emit('closing', from.params);
	to.item.emit('opening', to.params);

	function closeNode() {
		self._closeNode(from, function () {
			from.item.emit('closed', from.params);
			self._openNode(to);
			to.item.emit('opened', to.params);
		});
	}

	return window.setTimeout(function () {
		if (!transition) {
			return closeNode();
		}

		from.item.emit('moving');
		to.item.emit('moving');

		transition(from.item, to.item, function () {
			from.item.emit('moved', from.params);
			to.item.emit('moved', to.params);
			window.setTimeout(closeNode, 0);
		});

	}, 0);
};


/**
 * NavTree.open opens a node with the given parameters.
 * If there is an active node, it will be closed automatically.
 * If cb is given, it will be called on close.
 */

NavTree.prototype.open = function (name, params, transition, cb) {
	if (this._opening) {
		return false;
	}

	this._opening = true;
	var from = this._stack.current();
	var to = this._createNode(name, params, cb);

	if (to) {
		this._transitionNodes(from, to, transition);
		this._stack.add(to);
		return true;
	}

	this._opening = false;
	return false;
};


NavTree.prototype.enqueue = function (name, params, transition, cb) {
	if (this._stack.isEmpty()) {
		// nothing is active now, so we instantly open the node

		this.open(name, params, transition, cb);
	} else {
		// something is already active, so we append to the end of the queue

		var node = this._createNode(name, params, cb);

		if (node) {
			this._nodeQueue.push({ node: node, transition: transition });
		}
	}
};


NavTree.prototype.replace = function (name, params, transition, cb) {
	// like open, but replaces the current node in the history stack
	// ignores the queue
	if (this._opening) {
		return false;
	}

	this._opening = true;
	var from = this._stack.current();
	var to = this._createNode(name, params, cb);

	if (to) {
		this._transitionNodes(from, to, transition);
		this._stack.replace(to);
		return true;
	}

	this._opening = false;
	return false;
};


NavTree.prototype.back = function (transition) {
	if (this._opening) {
		return false;
	}

	this._opening = true;
	var from = this._stack.current();
	var to = this._stack.back();

	if (to) {
		this._transitionNodes(from, to, transition);
		this._opening = false;
		return true;
	} else {
		this._stack.forward();
	}

	this._stack.forward();
	this._opening = false;
	return false;
};


NavTree.prototype.forward = function (transition) {
	if (this._opening) {
		return false;
	}

	this._opening = true;
	var from = this._stack.current();
	var to = this._stack.forward();

	if (to) {
		this._transitionNodes(from, to, transition);
		return true;
	}

	this._opening = false;
	return false;
};


NavTree.prototype.close = function (response) {
	// manual close
	// that means we open the first queued node, or if none are available, we consider this a "back" request.

	// try to open a queued node

	var queue = this._nodeQueue.shift();

	if (queue) {

		this.replace(queue.node.name, queue.node.params, queue.transition);

	} else {
		// there was no queued node, so we execute a back() request

		this._response = response;
		var wentBack = this.back();

		// drop everything after the current node (if there is no current node, it will just clear all)

		this._stack.clearFuture();


		if (wentBack) {
			return;
		}

		// if there was no node to go back to, the navTree can be considered empty

		var currentNode = this._stack.current();

		if (!currentNode || !currentNode.item) {
			return;
		}

		this._stack.clear();

		currentNode.item.emit('closing', currentNode.params);
		this._closeNode(currentNode, function () {
			currentNode.item.emit('closed', currentNode.params);
		});
	}

};


NavTree.prototype.clearHistory = function () {
	// cleanup function to be called whenever hitting a point
	// where no back-option is available, like a main-screen.

	this._stack.resetToCurrent();
};
