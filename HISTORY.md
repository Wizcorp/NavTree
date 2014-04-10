# Release history

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