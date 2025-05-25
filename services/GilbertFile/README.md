# GilbertFile

GilbertFile implements a virtual file object that can be used by the Gilbert text file compiler. GilbertFile was inspired by Vinyl as earlier versions of Gilbert relied heavily upon Vinyl and VinylFS. However, GilbertFile is a more lightweight implementation that does not require the Vinyl library. It also provides a more flexible interface for file operations, allowing for easier integration with the Gilbert compiler.

Since GilbertFile is a subset of the VinylFile interface it is free of external dependencies, other than the mime library for detecting and setting mime types. It also does not suffer from extremely outdated libraries and comes with more than 30 tests.
