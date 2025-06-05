---
title: 'Supporting other languages. Part 2: C++ reflection system'
date: 2025-06-04
draft: true
tags: ['API', 'c', 'c++', 'core', 'reflection']
# thumbnail: 'https://venturebeat.com/wp-content/uploads/2024/12/Vulkan-1.4-16by9.jpg?w=1024?w=1200&strip=all'
slug: 'reflection-system-pt-2'
author: 'Alan Ramírez Herrera'
---
# Supporting other languages. Part 2: C++ reflection system

In the previous article, we explored the binding system and how it allows us to create a C API for our C++ code. In this article, we will delve into the reflection system, a powerful feature that enables us to inspect, manipulate, and create instances of types at runtime. This capability is essential for saving scenes, serializing data, and displaying information about types in the editor.

## Table of contents
- [Introduction](#introduction)
- [The reflection system](#the-reflection-system)
- [The ReflectionDB](#the-reflectiondb)
- [TypeInfo](#typeinfo)
- [FunctionInfo and InPlaceCtor](#functioninfo-and-inplacector)
- [Variant and VariantView](#variant-and-variantview)
- [Using the reflection system](#using-the-reflection-system)
- [Serializing and deserializing types](#serializing-and-deserializing-types)
- [Conclusion](#conclusion)

## Introduction
In the previous article, we discussed the binding system and how it allows us to create a C API for our C++ code. In this article, we will explore the reflection system, which is a powerful feature that allows us to inspect and manipulate the structure of our C++ code at runtime.

This is particularly useful for creating instances of types at runtime given their name, which will allow us to save scenes, serialize data, and display
information about types in the editor.

I won't go into what is reflection, as it is a well-known concept in programming languages.

It is important to mention that the `hush-reflection` tool is fully integrated into the Hush Engine CMake build system, so you don't have to worry about running it manually. It will automatically generate the reflection info for the types defined in your codebase when you edit any header file. :)

## The reflection system
It is widely known that C++ does not provide a built-in reflection system, nor in compile time or runtime. This might change in C++26 with the introduction
of a compile-time reflection system, but for now, we have to implement our own.

There are several implementations of reflection systems in C++, but we have decided to implement our own system because we want to have full control over the system and its features. And, since we need to support C, we want to use the binding system to expose the reflection system to C.

Hush Engine's reflection system aims to be as simple to use as possible, while still providing the necessary features to inspect and manipulate types at runtime. The system is composed of two main components: the reflection DB (and its API) and the `hush-reflection` tool.

The reflection DB is composed of a set of classes that represent the types in our code, their members, and their properties.
Mainly, it is composed of the following classes:
- `ReflectionDB`: The main class that holds the reflection data. It is used to register and query types.
- `TypeId`: A unique identifier for each type in the reflection system. It is used to reference types in the reflection DB. It is a custom struct that holds a `uint64_t` value, which is a unique identifier for the type.
- `TypeInfo`: Represents a type in the reflection system. It holds information about the type's name, size, alignment, and its members.
- `FunctionInfo`: Represents a function in the reflection system. It holds information about the function's name, return type, and its parameters.
- `FieldInfo`: Represents a member of a type in the reflection system. It holds information about the member's name, type, and offset.
- `InPlaceCtor`: A class that represents a constructor that can be used to create an instance of a type in place. It holds information about the constructor's parameters and their types.
- `Variant`: A class that represents a variant type, which can hold any type of value that is registered in the reflection system. It is used to store values of different types in a single variable.
- `VariantView`: A class that represents a view of a variant type. It is used to access the value of a variant type without copying it.

And the `hush-reflection` tool is a Libtooling-based tool that generates the reflection info for a given C++ struct/class.

The main advantage of Hush's reflection system is that it does not add any memory overhead to the types that are registered in the reflection system nor
it requires any base class to be used. This means that we can register any type in the reflection system without modifying the type itself.

However, it does require some boilerplate code to register the types in the reflection system. Manual code for registering types can be seen in some 
of the tests for the reflection system. But, Hush shines with its `hush-reflection` tool, which generates the reflection info for a given C++ struct/class.
This requires some annotations in the code, but it is a small price to pay for the benefits of having a reflection system.

To keep things simple, when reflecting things, we need to provide small wrappers around 
what needs to be reflected, so we don't need to think about member function pointers,
constness, and other details that can complicate the reflection system. 
This is achieved by lambda functions that are used to wrap the member functions and properties of the type. You can see wrappers in the `HUSH_GENERATED_BODY` macros and
on the test cases for the reflection system.

The `hush-reflection` tool will generate the necessary code to register the type in the reflection system, including the `TypeId`, `TypeName`, and the reflection data for the type's members and functions.

For instance, the following code is a full example of a C++ struct that has its reflection info generated by the `hush-reflection` tool:

```cpp

#include <reflection/Type.hpp>
#include <serialization/Serialization.hpp>
#include <serialization/Deserialization.hpp>
#include <Hushgen.hpp>

#if __has_include("MyClass.hushgen.hpp") && !defined(HUSH_HEADER_PARSING)
#include "MyClass.hushgen.hpp"
#endif

struct [[hush::reflect]] MyStruct
{
HUSH_GENERATED_BODY
public:
    [[hush::function]]
    MyStruct() {}

    int GetInt() const { return myInt; }

private:
    [[hush::property]]
    int myInt = 0;
};
```

Notice the `HUSH_GENERATED_BODY` macro, which contains the generated boilerplate code for the reflection system. This macro is generated by the `hush-reflection` tool and should be placed in the class/struct definition. As for the annotations, they are used to specify what should be exposed.

> Note
> 
> If we annotate a private property with `[[hush::property]]`, it will be exposed in the reflection system and we can access it through the reflection API

## The ReflectionDB
The `ReflectionDB` is the main user-facing class of the reflection system. It is used
to register types and query information about them. We can create as many instances of the `ReflectionDB` as we want, but we need to register the types in the reflection DB before we can use them.

> Note
>
> Hush Engine will have a single instance of the `ReflectionDB` that will be used throughout the engine. This instance will be created at startup and will be used to register all the types in the engine.

This class is thread-safe both when querying and registering types, so we can use it in a multithreaded environment without any issues. To achieve this, the class
uses a `std::shared_mutex` to protect the internal data structure (a `std::unordered_map`) that holds the reflection data. This allows us to have multiple readers and a single writer at a time, which is the main use case for the reflection system: many reads, only a few writes.

## TypeInfo
This class represents a single type in the reflection system. It holds information about the type's name, size, alignment, and its members. So, basically, the metadata of the type.

With a `TypeInfo` instance, we can perform various operations, such as:
- Getting the type's name.
- Getting the type's size.
- Getting the type's alignment.
- Getting the type's members.
- Getting the type's functions.
- Constructing an instance of the type (both in-place and as a variant).

For the last point, when creating instances of a type, you can use the in place 
functions to use an already allocated memory, or you can use the normal functions
to create a new instance of the type. Keep in mind that the in-place functions won't
manage the lifetime of the object, so you will have to manage it yourself
(calling the dtor and freeing the memory if needed). This is useful for the
ECS regions, so we can construct instances of the types inside the region's memory
without having to allocate memory for each instance nor creating a variant to hold the instance.

While you can create your own `TypeInfo` instances, it is recommended to use the 
builder that the `ReflectionDB` provides as it simplifies the process of creating a `TypeInfo` instance and ensures that all the necessary information is provided.

> Note
>
> When querying the `ReflectionDB` for a type, it will return a const pointer to a `TypeInfo` instance. This means that the type information is immutable and cannot be modified at runtime. This is a design choice to ensure that the reflection system is thread-safe and that the type information remains consistent throughout the lifetime of the application.

## FunctionInfo and InPlaceCtor
These classes represent functions. `FunctionInfo` holds information about the function's name, return type, and its parameters, while `InPlaceCtor` represents a constructor that can be used to create an instance of a type in place.

We can invoke a function by using `CallFunction` on the `TypeInfo` instance, which will return a `Variant` that holds the result of the function call. As we only support non-static functions, we need to provide an instance of the type to call the function on. This is done by passing a `VariantView` that holds the instance of the type.

For `Variant`-returning functions, we also used the `FunctionInfo` class and the same
rules apply.

## Variant and VariantView
These classes integrate tightly with the reflection system, allowing us to store and manipulate values of different types that are registered in the reflection system.

`Variant` is a type-safe union that can hold any type that has a `TypeId` 
(reflection DB is not required for that). It provides a way to store values of different types in a single variable, while still being able to access the value's type information and call functions on it.
This class has a small object optimization that allows to store small values directly
in the `Variant` instance, avoiding the need to allocate memory for them.
If the value is larger than the small object optimization size, it will allocate memory on the heap to store the value.
This also manages the lifetime of the value, so we don't have to worry about
calling the destructor or freeing the memory. :)

`VariantView` is a lightweight object that provides a view of a `Variant` or a value
of a type that has a `TypeId`. It allows us to access the value without copying it, which is useful as the reflection types usually take a span of `VariantView` to
call functions or access properties.

## Using the reflection system
To use the reflection system, we need to register the types in the reflection DB. This should be done by implementing a static function that registers the types in the reflection DB. I should mention that all of this boilerplate code is generated by the `hush-reflection` tool, so you don't have to write it manually.

```cpp
struct MyStruct
{
    // ...
    static void RegisterReflection(Hush::Reflection::ReflectionDB& db)
    {
        db.RegisterClass<MyStruct>()
            .AddConstructor(...)
            .AddInPlaceConstructor(...)
            .AddFunction(...)
            .AddProperty(...)
            .Register();
    }

    static constexpr std::uint64_t TypeId()
    {
        return Hush::Hashing::Fnv1a64("MyStruct");
    }

    static constexpr std::string_view TypeName()
    {
        return "MyStruct";
    }
    /// ...
}
```

This function should be called to register the type in the reflection DB.
After registering the type, we can query the reflection DB to get information about
the type, such as its name, size, alignment, and its members.

When querying the reflection DB, we have two main ways to do it:
- Using the full type name.
- Using the template function (internally calls the string version, C++ only).

```cpp
const TypeInfo* typeInfo = db.GetTypeInfo<MyStruct>();
// or
const TypeInfo* typeInfo = db.GetTypeInfo("MyStruct");
```

And we can use the `TypeInfo` instance to access the type's members, functions, and properties.
For instance, given the following type:

```cpp
struct MyStruct
{
HUSH_GENERATED_BODY
public:
    [[hush::function]]
    MyStruct() {}

    [[hush::function]]
    void PerformAction(int value) const
    {
    }

    [[hush::property]]
    int myInt = 0;
};
```

We can access the type's members and functions like this:

```cpp
const TypeInfo* typeInfo = db.GetTypeInfo<MyStruct>();
assert(typeInfo != nullptr);

MyStruct myStructInstance;

// Calling a function
int value = 42;
// It returns a Result<Variant, Error> with the result of the function call
(void)typeInfo->CallFunction("PerformAction", {Hush::Reflection::VariantView(&myStructInstance), Hush::Reflection::VariantView(&value)});
// Accessing a property
auto& field0 = typeInfo->GetFields()[0];
assert(field0.GetName() == "myInt");

// Getting the value of the property
myStructInstance.myInt = 42; // Default value
Hush::Result<Hush::Reflection::Variant, Variant::EVariantError> field0ValueResult = field0.Get({Hush::Reflection::VariantView(&myStructInstance)});
assert(field0ValueResult.has_value());
Hush::Result<int*, Hush::Reflection::VariantView::EVariantError> field0Value = field0ValueResult.value().Get<int>();
assert(field0Value.has_value());
assert(*field0Value.value() == 42);

// Etc...
```

## Serializing and deserializing types
While not the focus of this article, the reflection system also provides a way to serialize and deserialize types using the `Serialization` and `Deserialization` classes. You can see how to use these classes in the tests for the Serialization and Deserialization systems.

The `hush-reflection` tool also generates the necessary code to serialize and deserialize types, so you don't have to write it manually (which, tbh, is a pain to do manually).

## Conclusion

As you can see, using the reflection system is straightforward. We can call functions, access properties, and get information about the type's members and functions.

From here, we need to expose the reflection system to C, so we can use it in the engine's C API. This will be done in the future, but the idea is to use the binding system to expose the reflection system to C. This will allow us to use the reflection system in the engine's C API and create a powerful and flexible API for the engine.

Stay tuned for the next article, where we will start connecting the dots and exposing the reflection system to C. This will allow us to use the reflection system in the engine's C API and create a powerful and flexible API for the engine.