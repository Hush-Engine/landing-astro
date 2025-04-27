---
title: 'Supporting other languages. Part 1: C Bindings'
date: 2025-03-29
draft: true
tags: ['API', 'c', 'c++', 'core', 'scripting']
# thumbnail: 'https://venturebeat.com/wp-content/uploads/2024/12/Vulkan-1.4-16by9.jpg?w=1024?w=1200&strip=all'
slug: 'binding-system-pt-1'
author: 'Alan Ramírez Herrera'
---
# Creating C bindings for Hush Engine

## Table of contents
- [Creating C bindings for Hush Engine](#creating-c-bindings-for-hush-engine)
    - [Introduction](#introduction)
        - [Brief overview of Hush Engine entry points](#brief-overview-of-hush-engine-entry-points)
    - [Exposing the API](#exposing-the-api)
    - [Working with Libtooling](#working-with-llvm)
        - [Creating a new C++11 attribute](#creating-a-new-c11-attribute)
        - [Exposing types and functions](#exposing-types-and-functions)
        - [Generating the bindings](#generating-the-bindings)
    - [Future work](#future-work)
    - [Conclusion](#conclusion)

## Introduction

<blockquote class="info-blockquote">
  <h2>ℹ️ <strong>Note:</strong></h2>
    <p>This is not the final API. We still have work to do on exposing the API. This first part contains the binding generator and exposing the API. Future parts will contain more on using the API and consuming it from other languages.</p>
</blockquote>

Hush Engine, while written in C++, aims to support other languages, especially C#. But unfortunately, we don't expose an easy way to use
the engine from other languages. Hush is designed to be the entry point for the application, so we need a way to expose the engine's API to other languages.

This, unfortunately, is not a trivial task. We need to expose parts of the engine to other languages, and we need to do it in a way that allows
us covering (almost) all the user-facing API. Also, we want to avoid manually writing the bindings, which is cumbrsome and error-prone as the API evolves.

This leads us with a small set of requirements:
- We need to be able to expose the API to other languages. Which means that we would like to have a C API.
- We want it to be easy to use and maintain. This means that we need to have a way to generate the bindings automatically.
- We need to support 2 use cases: the engine being the entry point (user code is compiled as a shared library) and the engine being used as a library (user code is compiled as a static library and linked with the engine, which contains the entry point).
- We need to support function pointers, as we want to expose the engine's API in a way that allows us to use it from other languages.

#### Brief overview of Hush Engine entry points
Hush Engine has a standard entry point, which is the `main` function. However, hush contains two CMake targets: `Hush::Engine` and `Hush::Runtime`. The first one is the engine itself, it is a static library
that contains the whole engine, including the entry point (it defines the `main` function). The second one is an executable that is linked with `Hush::Engine` and its purpose is to allow loading
user code as a shared library. This means that Hush Engine supports two deployment models:
- Deploy the `Hush::Runtime` target with all the user code as a shared library. This is the default deployment model.
- Deploy the user code as a static library and link it with `Hush::Engine`. This model is used by the editor, which is an executable **but does not define a main function**.

For C#, the second deployment model means that we will support C# AoT native compilation.
This might be a requirement for game consoles (TBD), which is something that we would like to support in the future.

## Exposing the API
The easiest way to expose the API is to use C. This allows interoperability with other languages that support C bindings, which, for practical purposes, is almost all of them.

However, as the engine is itself the entry point, we cannot use a simple FFI such as `[DDLImport]` in C# or `extern` in C. This is true when the user code is compiled as a shared library.
When the user code is compiled as a static library, we can just link with the engine and use the API. However, we would like to support both cases even if we have a minimal overhead when
everything is statically linked.

This leads us with creating a minimal C API that calls the C++ API and expose it through function pointers. When the user code is loaded, the engine will supply the function pointers to the engine APIs.
User code needs an entry point. This entry point is a function with C calling convention that takes one argument: a struct with the function pointers AND a pointer to the engine instance. This is the only way to get the function pointers.
With the engine instance, and the function pointers, the user code can call the engine API, and perform operations such as registering components, creating entities, loading the first scene, etc.

<blockquote class="info-blockquote">
  <h2>ℹ️ <strong>Note:</strong></h2>
    <p>This is not the final API. Notice that we are using C# <a href="https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/proposals/csharp-9.0/function-pointers">function pointers</a>.</p>
</blockquote>
    

```c
typedef struct HushEngine HushEngine;
typedef struct Scene Scene;

typedef struct HushEngineFuncPtrTable {
    Scene* (*GetCurrentScene)(HushEngine* engine);
    uint64_t (*RegisterComponent)(Scene* scene, const char* name); // Not real API!
} HushEngineFuncPtrTable;

typedef struct HushEngineAPI {
    HushEngineFuncPtrTable* funcPtrs;
    HushEngine* engine;
} HushEngineAPI;
```

The C# entry point might look like this (user-facing code will have a proper wrapper, this is still a work in progress, currently it is not generated):
```csharp

[StructLayout(LayoutKind.Sequential)]
public struct HushEngine
{
    public IntPtr handle;
}

[StructLayout(LayoutKind.Sequential)]
public struct Scene
{
    public IntPtr handle;
}

[StructLayout(LayoutKind.Sequential)]
public struct HushEngineFuncPtrTable
{
    public delegate* unmanaged<HushEngine*, Scene*> GetCurrentScene;
    public delegate* unmanaged<Scene*, byte*, ulong> RegisterComponent;
}

[StructLayout(LayoutKind.Sequential)]
public struct HushEngineAPI
{
    public IntPtr funcPtrs;
    public IntPtr engine;
}

public class HushRuntime
{
    public static HushEngineAPI* api;
    
    [UnmanagedCallersOnly(EntryPoint = "BundledApp_Internal_")]
    public static void BundledApp_Internal(HushEngineAPI* api)
    {
        HushRuntime.api = api;
        // Call the engine API using the function pointers
        Scene* scene = api->funcPtrs->GetCurrentScene(api->engine);
    }
}
```

With this, a call to the engine will be a simple function pointer call, and while this might have some overhead, it is negligible compared to the cost of the engine API itself.

The next thing is, how do we generate this?

We have a few options:
- Make annotations on code that needs to be exported. This could be implemented with comments (not ideal) or with annotations (a-la Unreal Engine with `UCLASS`, `UPROPERTY`, etc.).
- Create a custom file to be parsed to generate the bindings, something like specifying the type, its properties, and the functions to be exported.

Given that, we decided to go with the first option. We will use custom annotations in the code to generate the bindings. However, we wanted to avoid using comments and custom macros (clang `__attribute__((annotated("...")))` is not portable). So we decided to use C++11 attributes.  However, this is not a trivial task. We cannot extract custom
attributes from Clang AST as they are discarded during the parsing process, so we need to modify Clang to support this.

Still, Clang offers three APIs:
- Libclang: This is a C API to work with Clang. Not as flexible as the other two, but it is easy to use and has a lot of documentation. It is not suitable for our needs.
- Clang plugin: This is a C++ API to work with Clang. It is a bit more complex than Libclang, but it is more flexible and allows us to modify the AST. However, it is not suitable for our needs as we need a global view of the AST to gather types and functions.
- Libtooling: This is a C++ API to work with Clang. It is a bit more complex than Libclang, but it is more flexible and allows us to modify the AST. It is also the most powerful API and allows us to create custom tools that can be used to analyze and modify the code.

We decided to go with Libtooling yet we require to compile clang.

Enter the custom attribute: `[[hush::export]]`.
This attribute will be used to mark the functions and types that we want to export. This attribute will be used to generate the bindings.
It supports the following types:
- Functions
- Classes
- Structs
- Enums

This attribute also includes a few options:
- `name`: The name of the function or type to be used in the bindings. This is useful to avoid name clashes and to use a different name in the bindings.
- `ignore`: Ignore this function or type.
- `asHandle`: Use this type as a handle. This is useful for types that are not trivially copyable or that we want to use as a handle in the bindings. For instance, no struct members will be exported, and the type will be used as a handle in the bindings.

```cpp
#include "hushexport.hpp"

#include <string_view>

namespace Hush
{
  class [[hush::export(Hush::Export::name("MyCustomFooExport"))]] Foo
  {
  public:
      [[hush::export(Hush::Export::name("FooBar"))]]
      void Bar(int a, int b);

      [[hush::export]]
      void Bar2(int a, int b);
  };

  struct [[hush::export]] Vector3
  {
      float x, y, z;
  };
  
  class [[hush::export(Hush::Export::asHandle)]] Scene
  {
  public:
      [[hush::export]]
      std::string_view GetName() const;

      int a;
  };  
}

```

This will generate the following bindings:

```c
#pragma once
#include <stdint.h>


#ifdef __cplusplus
extern "C" {
#endif

typedef struct MyCustomFooExport {
} MyCustomFooExport;

typedef struct Hush__Vector3 {
	float x;
	float y;
	float z;
} Hush__Vector3;

typedef struct Hush__Scene;

extern void FooBar(MyCustomFooExport *self, int a, int b);
extern void Hush__Foo__Bar2(MyCustomFooExport *self, int a, int b);
extern void Hush__Scene__GetName(void (*retFunc)(const char* , size_t, void*), void* retUserData, Hush__Scene *self);
typedef struct HushFuncPtrTable {
	void (*HushFuncPtr_FooBar)(MyCustomFooExport *self, int, int);
	void (*HushFuncPtr_Hush__Foo__Bar2)(MyCustomFooExport *self, int, int);
	void (*HushFuncPtr_Hush__Scene__GetName)(void (*retFunc)(const char*, size_t, void*), void* retUserData, Hush__Scene *self);

} HushFuncPtrTable;

#ifdef HUSH_STATIC_BINDING
extern HushFuncPtrTable HUSH_FUNCPTR_TABLE;
#endif

#ifdef __cplusplus
}
#endif
```

Notice that:
- When exporting with `asHandle`, the struct members are not exported. The type will only be usable as a pointer.
- The function pointers are generated with the `HushFuncPtr_` prefix.
- Member functions are exported as free functions with a `self` pointer.
- Returning `std::string_view` is not possible, so we use a callback to return the string as a pair of `const char*` and `size_t`.
- We generate a function pointer table that contains the function pointers. This is used to call the functions from the user code.


## Working with Libtooling

Working with Libtooling requires the LLVM source code. Compiling it, while not difficult, it takes a bit of time. You can find
our LLVM fork [here](https://github.com/Hush-Engine/hush-llvm).

There are plenty of examples on how to compile LLVM, and the official documentation on Libtooling is good. For the sake of this post, we will not go into details on how to compile LLVM. We will assume that you have a working LLVM installation.

Since we want to use C++11 attributes, we need to modify the Clang source code to support this.

#### Creating a new C++11 attribute
To create a new C++11 attribute, we need to modify the `Attr.td` file in the Clang source code. This file contains the definitions of all the attributes that are supported by Clang. We will add a new attribute called `hush::export` that will be used to mark the functions and types that we want to export.

The modification to the `Attr.td` file is simple. We need to add a new entry for the `hush::export` attribute. The entry looks like this:

```cpp
// clang/include/clang/Basic/Attr.td
def HushExport : InheritableAttr {
  let Spellings = [CXX11<"hush", "export">];
  let Args = [VariadicExprArgument<"ExportConfig">];
  let Subjects = SubjectList<[Function, Record, NonBitField, ParmVar, Enum]>;
  let Documentation = [Undocumented];
}
```

This will create a new attribute called `[[hush::export]]` that can be used to mark functions and types. The `Args` field specifies that the attribute takes a variadic argument, which will be used to specify the options for the attribute. The options are defined in a custom header file that will be included in
every file that uses the attribute.

The `Subjects` field specifies that the attribute can be used on functions, records, non-bit fields, parameter variables, and enums. The `Documentation` field is set to `Undocumented`, which means that the attribute will not be documented in the Clang documentation.

But we're far from done. We need to modify the `SemaDeclAttr.cpp` file to handle the new attribute. This file contains the code that processes the attributes and generates the code for them. We need to add a new case for the `hush::export` attribute. In the function `ProcessDeclAttribute`, we need to add a new case for the `HushExport` attribute. This function is responsible for processing the attributes and generating the code for them.

```cpp
//...
case ParsedAttr::AT_HushExport:
    handleHushExportAttr(S, D, AL);
    break;
//...
```

In the `handleHushExportAttr` function, we perform some validation on the attribute. Since we don't generate new code or modify the AST, we don't need to do much here. We just need to check that the attribute is used on a valid type and that the options are valid. Finally, we add the attribute to the declaration.

```cpp
D->addAttr(::new (S.Context) HushExportAttr(S.Context, AL, HushArgs.data(),
                                              HushArgs.size()));
```

This will add the attribute to the declaration and allow us to use it in the code generation phase.

And we're done with the attribute. We can now use it in the code and generate the bindings.

### Exposing types and functions

As previously stated, we need to annotate the types and functions that we want to export. But, how do we find them? We need to traverse the AST and find the types and functions that have the `hush::export` attribute.

Libtooling provides different ways to traverse the AST. For practical purposes, we chose to use [ASTMatchers](https://clang.llvm.org/docs/LibASTMatchers.html).
This is a powerful library that allows us to traverse the AST and find the nodes that match a specific pattern. We can use this library to find the types and functions that have the `hush::export` attribute.
Since we only support functions, classes, structs, and enums, we can use the following matchers:

```cpp
DeclarationMatcher HushExportAttrMatcher =
    decl(recordDecl(hasAttr(clang::attr::HushExport))).bind("hushExportable");

DeclarationMatcher HushExportFunctionMatcher =
    decl(functionDecl(hasAttr(clang::attr::HushExport))).bind("hushExportable");

DeclarationMatcher HushExportEnumMatcher =
    decl(enumDecl(hasAttr(clang::attr::HushExport))).bind("hushExportable");
```

Notice that we are binding the matchers to a name. This allows us to retrieve the `HushExportAttr` attribute from the matched node. With this, we can then later
retrieve its parent node and check if it is a function, class, struct, or enum and parse them accordingly.
To do this, we need to create a custom `MatchCallback` class that will be used to process the matched nodes. This class will be responsible for processing the nodes and generating the bindings. 

```cpp
class HushBindingMatcher : public MatchFinder::MatchCallback {
    /*..*/
public:

  virtual void run(const MatchFinder::MatchResult &Result) {
    if (const clang::RecordDecl *D =
            Result.Nodes.getNodeAs<clang::RecordDecl>("hushExportable")) {
      clang::HushExportAttr *HushExportAttr =
          D->getAttr<clang::HushExportAttr>();
      processClassDecl(/*..*/);
    }

    if (const clang::FunctionDecl *FD =
            Result.Nodes.getNodeAs<clang::FunctionDecl>("hushExportable")) {
      clang::HushExportAttr *HushExportAttr =
          FD->getAttr<clang::HushExportAttr>();
      processFunctionDecl(/*..*/);
    }

    if (const clang::EnumDecl *ED =
            Result.Nodes.getNodeAs<clang::EnumDecl>("hushExportable")) {
      clang::HushExportAttr *HushExportAttr =
          ED->getAttr<clang::HushExportAttr>();
      processEnumDecl(/*..*/);
    }
  }

  /*...*/
};
```

However, we have one rule when processing the nodes: If the node uses a `Record` type, we need to check if the record has been parsed before. This
serves as a validation step to avoid exposing types are not exported. For this reason, things such as forward declarations are not supported. We need to have the full definition of the type in order to export it. This is a limitation of the current implementation and we will check if this is a problem in the future.

Each of the `process*Decl` functions will be responsible for processing the matched nodes and generating the bindings. We will not go into details on how to do this, as it is a bit out of scope for this post. But in short, we gather information such as:
- The name of the type or function to be used in the bindings.
- The member variables of the type (if it is a class or struct).
- The parameters of the function (if it is a function).
- The return type of the function (if it is a function).
- The options of the attribute (such as `asHandle`, `name`, `ignore`, etc.).
- If it supports `const` and `&` qualifiers.
- If it is a member function or a free function.

There's, however, some types that we cannot annotate with `[[hush::export]]` but we still want to export, which is the case of types not defined by Hush Engine.
For instance, `std::*` types, `glm::*` types, etc. For this, we perform special handling of these types. We will not go into details on how we perform this.

There's, however, types in functions that we handle specially. For instance, `std::string_view`, `std::span`, `std::vector`, etc. For this types, it depends
on wether they are used as parameters or return types. For return types, we generate a callback function that provides a pair of `const char*` and `size_t`.
Unfortunately, this means that we do not support returning references to these types. For parameters, we generate a function that takes a pointer to the type and a size. 
While this is a limitation, we can have workarounds for this. For instance, when adding things to a `std::vector` inside a class, we could export a function that performs this step.

### Generating the bindings

The final step is to generate the bindings. At this point, we have vectors of functions and types that we want to export. So, exposing them is as simple as iterating over the vectors and generating the bindings.
To do this, we concatenate the strings and write them to a file. We also need to generate the function pointer table, which is a bit more complex. And finally, we generate the
function pointer table, which reuses the prototypes of the functions and types that we generated before. This is done in a separate function that reuses the information gathered when
generating the bindings for the functions.

We don't perform a lot of validation when generating the bindings as most of the validation is done when processing the nodes.

The generated bindings create two files: `HushBindings.h` (contents have been shown before) and `HushBindings.cpp`. The first one contains the types, functions, and the function pointer table. The second one contains the implementation of the functions and the function pointer table. The implementation of the functions is simple. For the previously shown example, the `HushBindings.cpp` file will look like this:

```cpp
// Auto-generated file
// DO NOT EDIT

#include "HushBindings.h"

void FooBar(MyCustomFooExport *self, int a, int b)
{
	auto selfClass = reinterpret_cast<Hush::Foo*>(self);
	selfClass->Bar(a, b);
}

void Hush__Foo__Bar2(MyCustomFooExport *self, int a, int b)
{
	auto selfClass = reinterpret_cast<Hush::Foo*>(self);
	selfClass->Bar2(a, b);
}

void Hush__Scene__GetName(void (*retFunc)(const char* , size_t, void*), void* retUserData, Hush__Scene *self)
{
	auto selfClass = reinterpret_cast<Hush::Scene*>(self);
	auto result______ = selfClass->GetName();
	retFunc(result______.data(), result______.size(), retUserData);
}

#ifdef HUSH_STATIC_BINDING
HushFuncPtrTable HUSH_FUNCPTR_TABLE = {
	FooBar,
	Hush__Foo__Bar2,
	Hush__Scene__GetName,
};
#endif
```

Neat, right?

Notice that for the handle types, we reinterpret the exposed type pointer to the original type. We could use a void pointer, but with a custom handle type, we gain a bit of type safety.

<blockquote class="info-blockquote">
  <h2>ℹ️ <strong>Note:</strong></h2>
    <p>We still need to implement the <code>#include</code>s in the generated cpp file. This is a work in progress.</p>
</blockquote>


## Future work

We still have a lot of work to do. The current implementation still lacks a lot of features that would be useful. Such as fixing a bug with multiple pointer types, supporting inheritance, and supporting more types. We also need to implement the `#include`s in the generated cpp file. But the most critical work has been done. We can now generate the bindings and use them in C# and other languages.

Also, with those generated bindings, we would like to define two CMake targets, one that links with the
runtime (`Hush::Runtime`) and one that links with the engine (`Hush::Engine`). When the runtime engine is used,
the engine will load the user code as a shared library and pass the function pointers to the user code. The
function pointer table will be defined in the engine though. When the user code is statically linked with the engine, the user code could use the function pointer table 
as an external symbol OR directly use the functions. But for the sake of simplicity, the engine will always provide the function pointer table to avoid changing
the user's entry point signature.

However, we also want to support another critical feature on top of Libtooling: Reflection. This is a lot more complex but will allow us creating types instances at runtime.
This will be needed when loading scenes or when exposing things through the editor. This will be part of the next series of posts.
Also, we still need to generate the C# bindings.

# Conclusion

We now have a tool to generate the bindings for the engine. This tool is not perfect, but it is a good starting point. We can now generate the C bindings but we still
have a lot of work to do.

However, this serves as a learning excercise on how to use Libtooling, which is a tool that is going to be useful when generating the reflection system.

Stay tuned for the next part of this series, where we will cover the reflection system and how to use it to create types at runtime. We will also cover how to use the generated bindings in C# and other languages.
