# Release history

## v0.3.0

### Saving private Ryan, and the others
Added an underscore in front of private variable to remove confusion.

### Something seems opened
Added the method `getOpenedItem` to get the current opened item.
:warning: It will return `undefined` if none.

### Didn't you tell me you were closed
The `'close'` event is now called when the item is really closed


## v0.2.6

### The history is in the past
Fixed the part where `#back` was changing the index when it was not going back.
Because of history change from `#back` the `#close` method couldn't close the item when alone in the stack.

### Call me back, but give me the correct info
The `#open` method can take a callback parameter but the arguments sent was not coming from the `#close` method.


## v0.2.5

### Dependencies update
- From `component/inherit` to `Wizcorp/util` v0.1.0
- From `Wizcorp/eventemitter` to `Wizcorp/events` v0.1.2

## v0.2.4

### Let me know when you're gone
NavTree#close should now emit the 'closing' and 'closed' events on the item.


## v0.2.3

### Implemented transition locking
This is solving the issue when views are opened at the same time, generally due to finger mashing.
There was a very long discussion about it and we decided to implement locking for now, where by if a
view is opening and still mid transition, another view open will be ignored. We looked at single
queue and multi-queue states as well, but decided to go with a simple solution for the time being.

The only instances we saw where a developer would want multiple views open at the same time, was if
a view open were to happen in async, i.e. you got a notification from the server which instructed
the application to open a view. However in most cases, there would be a preliminary step between
that and the actual open, allowing the user to decide whether or not to actually proceed to the
view. This ultimately removed the need for automatic view opening, which rendered the multiple views
opening argument a tad mute. So we opted to not accommodate this just yet.

You can use the return values to know whether or not your view is going to open. We only return
false when the view is not set to transition in (which means will not open, as even an empty
transition is an immediate open)
```javascript
if (!navTree.open('yourView')) {
    return;
}

// Thing you will do in the same tick before open, but depend on the view being open
// This is a rare-case, and unlikely to be used, but decided to do this properly so put it in there
```

## v0.2.2

### Binding means no hash
The hash was changing even if the navTree wan not bind to the browser


## v0.2.1

### This is not self
Cannot use `this` within a function


## v0.2.0

### Asynchrone closure
A callback function can be use as the second argument of the `close` method of the item.
This will allow some animation, or other asynchronus event to happen before changing view


## 0.1.0

First version