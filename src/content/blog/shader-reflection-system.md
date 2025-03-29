---
title: 'Writing A Shader Reflection System In Vulkan'
date: 2025-03-28
draft: false
tags: ['graphics', 'enginedev', 'tutorial', 'vulkan']
thumbnail: 'https://venturebeat.com/wp-content/uploads/2024/12/Vulkan-1.4-16by9.jpg?w=1024?w=1200&strip=all'
slug: 'shader-reflection-system'
author: 'Leónidas Neftalí González Campos'
---
# Writing A Shader Reflection System In Vulkan

#### Note: All code presented here is a simplification of the implementation you can find in [HushEngine](https://github.com/Hush-Engine/Hush-Engine)
## Premise and purpose
When making a game engine you generally want the end-user, the game developer to be able to interact and expand your systems, and rendering is one of the most important ones to get right, as it makes or breaks the style of their game. To enable our user's creativity, they need to be able to write their own shaders, and the engine should provide them with an easy to use API that will allow them to modify values of their materials at runtime or in the editor, this can make for cool mesh effects and custom post-processing alike.

We don't have the time or energy to implement our own shading language like Unity did with ShaderLabs (as they include runtime information about the shader in the actual code),
## The setup
We'll be using the HushEngine's tech stack, which is comprised of:
- C++20
- Vulkan 1.3+
- GLSL version 450
- [SPIRV-Reflect](https://github.com/KhronosGroup/SPIRV-Reflect)
All examples below will follow assuming these are the base technologies we're working with.
### Some basic terminology
Graphics is a complex topic, so with the purpose of brevity, I'll be using some loose terms to refer to more extensive concepts.
- CPU-Land
	- Code and regions of memory that can be accessed and modified using general purpose programming languages, hence they are bound to the CPU-side of things.
- GPU-Land
	- Code and regions of memory that can **ONLY** be accessed within shaders, hence they are bound to the GPU-side of things.

Alright, **let's get started!**

## Shader Modules
To start we'll need to upload our compiled shaders to Vulkan, we'll assume you already have a rendering pipeline setup because god knows that's out of scope for this article.

We'll create a function to load both vertex and fragment shaders from the filesystem, this operation could fail so we'll also include some errors as values return codes.
#### `ShaderMaterial.hpp`
```cpp
class ShaderMaterial {
public:
	enum class EError
	{
		None = 0,
		FragmentShaderNotFound,
		VertexShaderNotFound
	};

	/// @brief Will create and bind pipelines for both shaders
	// Returns an error in case this fails
	EError LoadShaders(IRenderer *renderer, const std::filesystem::path &fragmentShaderPath, const std::filesystem::path &vertexShaderPath);

private:
	IRenderer *m_renderer;

};
```

We assume `IRenderer` to be an API-agnostic renderer interface that we can turn into the implementation specific one later on.

### SPIRV buffers
Shaders compiled to the `.spv` file format can be reflected on with the [SPIRV-Reflect library](https://github.com/KhronosGroup/SPIRV-Reflect) which is the package we'll be using to get information about the shader's memory layout and how to build an API around it.
`SPIRV-Reflect` expects the shader data to be a buffer of **unsigned 32-bit** separated elements describing the compiled shader (`std::vector<uint32_t> spirvByteCodeBuffer`).

Let's make a utility class to help us load in each shader.
#### `VulkanHelper`
```cpp
class VulkanHelper final
{
public:
	static bool LoadShaderModule(const std::string_view &filePath, VkDevice device, VkShaderModule *outShaderModule, std::vector<uint32_t> *outBuffer);

private:
	static void ReadDataInto(std::vector<uint32_t> &buffer, std::ifstream &file, size_t fileSize);
};

```

#### `VulkanHelper` Implementation
```cpp
bool Hush::VulkanHelper::LoadShaderModule(const std::string_view &filePath, VkDevice device, VkShaderModule *outShaderModule, std::vector<uint32_t> *outBuffer)
{
	// Open the file. With cursor at the end
	std::ifstream file(filePath.data(), std::ios::ate | std::ios::binary);
	if (file.fail() || !file.is_open())
	{
		return false;
	}

	// Find what the size of the file is by looking up the location of the cursor
	// Because the cursor is at the end, it gives the size directly in bytes
	uint32_t fileSize = static_cast<uint32_t>(file.tellg());

	// Create a new shader module, we'll make this reference our loaded buffer
	VkShaderModuleCreateInfo createInfo = {};
	createInfo.sType = VK_STRUCTURE_TYPE_SHADER_MODULE_CREATE_INFO;
	createInfo.pNext = nullptr;

	// Spirv expects the buffer to be on uint32, so make sure to reserve a int
	// vector big enough for the entire file
	size_t bufferSize = fileSize / sizeof(uint32_t);
	outBuffer->resize(bufferSize, 0);

	ReadDataInto(*outBuffer, file, fileSize);
	// codeSize has to be in bytes, so multply the ints in the buffer by size of
	// int to know the real size of the buffer
	createInfo.codeSize = outBuffer->size() * sizeof(uint32_t);
	createInfo.pCode = outBuffer->data();

	VkShaderModule shaderModule = nullptr;
	if (vkCreateShaderModule(device, &createInfo, nullptr, &shaderModule) != VK_SUCCESS)
	{
		return false;
	}
	*outShaderModule = shaderModule;
	return true;
}

void Hush::VulkanHelper::ReadDataInto(std::vector<uint32_t> &buffer, std::ifstream &file, size_t fileSize)
{
	// Put file cursor at beginning
	file.seekg(0);

	// Load the entire file into the buffer
	auto *fileData =
		reinterpret_cast<char *>(buffer.data()); // We downsize this, but idk, this is how it expects us to use it
	file.read(fileData, fileSize);

	// Now that the file is loaded into the buffer, we can close it
	file.close();
}


```

These functions can now be used to properly load both of our shaders into memory back on `ShaderMaterial.cpp`.

#### `ShaderMaterial.cpp`
```cpp
Hush::ShaderMaterial::EError Hush::ShaderMaterial::LoadShaders(IRenderer *renderer, const std::filesystem::path &fragmentShaderPath, const std::filesystem::path &vertexShaderPath)
{
	this->m_renderer = renderer;
	auto *rendererImpl = dynamic_cast<VulkanRenderer *>(renderer);
	VkDevice device = rendererImpl->GetVulkanDevice();
	VkShaderModule meshFragmentShader = nullptr;
	std::vector<uint32_t> spirvByteCodeBuffer;

	if (!VulkanHelper::LoadShaderModule(fragmentShaderPath.string(), device, &meshFragmentShader, &spirvByteCodeBuffer))
	{
		return EError::FragmentShaderNotFound;
	}

	VkShaderModule meshVertexShader = nullptr;
	if (!VulkanHelper::LoadShaderModule(vertexShaderPath.string(), device, &meshVertexShader, &spirvByteCodeBuffer))
	{
		return EError::VertexShaderNotFound;
	}
	return EError::None;
}
```

**We will be constantly modifying this implementation** but for now, this just loads in all our shaders so we can run reflection on them.

Speaking of which...
## Reflection bindings

A binding is a description of how the shader's memory is laid out, different GPU memory buffers will have different properties, but we will largely focus on **uniform buffers** which are specialized structures that group together uniform variables into a single buffer object, this ensures they are tightly stored together one after the other with an alignment standard (generally [`std140`](https://www.oreilly.com/library/view/opengl-programming-guide/9780132748445/app09lev1sec2.html), which means the buffer is sectioned into uniformly separated data segments according to these rules:
- Scalars (`bool, int, uint, float`)
	- Aligned to 4 bytes
- Vectors
	- `vec2` aligned to 8 bytes
	- `vec3` aligned to 16 bytes
	- `vec4` aligned to 16 bytes

Sometimes this will result in extra *padding* added to the memory layout, for example:
The `vec3` data type encapsulates 3 scalar floating point values, of *4 bytes each*, which comes down to *12 bytes*, but `std140` will add an extra 4 bytes to comply with the GPU memory layout, we have to take this into consideration in our binding structure.

#### `ShaderBindings.hpp`
```cpp
struct ShaderBindings
{

	enum class EBindingType
	{
		Unknown, // There are many, maaaaany more bindings in GLSL, but we'll aim to handle uniforms first
		UniformBuffer, // Describes the entire buffer structure, as in, the object that contains all the uniform fields
		UniformBufferMember, // Specific uniform field
	};

	// NOTE: Some of these variables are not all needed for all bindings, but will be there for the applicable ones
	uint32_t bindingIndex{}; // Index of the entire buffer
	uint32_t size{}; // Padded size of the field (16 for vec3, 8 for vec2, etc.)
aa	uint32_t offset{}; // Where to start reading memory from the buffer
	uint32_t setIndex{}; // Index of the descriptor set containing this buffer, we'll assume there is only one set, but will leave here as an excercise to the reader
	EBindingType type = EBindingType::Unknown;
};

```

Now we're gonna add a couple new functions to our `ShaderMaterial` to process these bindings.
#### `ShaderMaterial.hpp`
```cpp
private:
	Result<std::vector<ShaderBindings>, EError> ReflectShader(const std::span<std::uint32_t>& shaderBinary);


	// Will bind Vulkan layouts to the shader information
	EError BindShader(const std::vector<ShaderBindings> &vertBindings, const std::vector<ShaderBindings> &fragBindings);
```

The header file is renderer-agnostic, but we will need to keep references to pipelines and descriptor layouts, so we're gonna cheat a bit here by having an Opaque structure where all that data will live, it's somewhat of an ugly approach, but it works well...

```cpp
	OpaqueMaterialData *m_materialData;
	// We'll also need a way to access any saved binding by its name, we'll go with a hash map for that
	std::unordered_map<std::string, ShaderBindings> m_bindingsByName;
	...
};
```

In the implementation file we can define our OpaqueMaterialData structure
#### `ShaderMaterial.cpp`
```cpp
struct OpaqueMaterialData
{
	VkMaterialPipeline pipeline{};
	VkDescriptorSetLayout descriptorLayout{};
	DescriptorWriter writer;
	VkBufferCreateInfo uniformBufferCreateInfo{};
};
```

Now we're ready to start getting the shader's metadata using SPIRV-Reflect, we could technically get an invalid compiled binary as a parameter, so in the interest of proper validation we'll add some values to our `EError` enumerator.
#### `ShaderMaterial.hpp`
```cpp
enum class EError
{
	None = 0,
	FragmentShaderNotFound,
	VertexShaderNotFound,
	ReflectionError, // Something funky happened when reading the spirv binary
	PipelineLayoutCreationFailed, // The pipeline was not able to be created
}
```
#### `ShaderMaterial.cpp`
```cpp
Hush::Result<std::vector<Hush::ShaderBindings>, Hush::ShaderMaterial::EError> Hush::ShaderMaterial::ReflectShader(const std::span<uint32_t>& shaderBinary)
{
	size_t byteCodeLength = shaderBinary.size() * sizeof(uint32_t);
	SpvReflectShaderModule reflectionModule;
	SpvReflectResult rc = spvReflectCreateShaderModule(byteCodeLength, shaderBinary.data(), &reflectionModule);

	if (rc != SpvReflectResult::SPV_REFLECT_RESULT_SUCCESS)
	{
		LogFormat(ELogLevel::Error, "Failed to perform reflection on shader, error: {}", magic_enum::enum_name(rc));
		return EError::ReflectionError;
	}

	// Result that will contain all found bindings
	std::vector<ShaderBindings> bindings;

```

We need to reserve a vector large enough to fit all our descriptors (which will contain all the variables in a uniform buffer), so we query the reflection library twice with [`spvReflectEnumerateDescriptorBindings`](https://github.com/KhronosGroup/SPIRV-Reflect/blob/main/spirv_reflect.h#L725), once to get the descriptor count, and a second time to fill up a vector with their data.

```cpp
	uint32_t descriptorCount{};
	// First query, we pass nullptr at the end because we don't have an initialized vector yet
	spvReflectEnumerateDescriptorBindings(&reflectionModule, &descriptorCount, nullptr);
	bindings.reserve(descriptorCount);

	std::vector<SpvReflectDescriptorBinding *> descriptorBindings(descriptorCount);
	// Now let's actually fill the vector up
	spvReflectEnumerateDescriptorBindings(&reflectionModule, &descriptorCount, descriptorBindings.data());
	for (const SpvReflectDescriptorBinding *descriptor : descriptorBindings)
	{

		ShaderBindings binding;
		binding.bindingIndex = descriptor->binding;
		binding.size = descriptor->block.size;
		binding.offset = descriptor->block.offset;
		binding.stageFlags = 0;
		switch (descriptor->descriptor_type) 
		{
		case SPV_REFLECT_DESCRIPTOR_TYPE_UNIFORM_BUFFER:
			binding.type = ShaderBindings::EBindingType::UniformBuffer;
			this->m_uniformBufferSize += binding.size;
			break;

		}
	}

}
```

## `Memory binding
At the end of the day, the purpose of a reflection system like this is to be able to share memory that is modified in CPU-Land and see that change reflected in the material instances of our shaders, 9
