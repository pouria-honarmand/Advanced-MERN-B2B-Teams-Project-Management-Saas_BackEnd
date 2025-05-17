import mongoose from "mongoose";
import UserModel from "../models/user.model";
import AccountModel from "../models/account.model";
import WorkspaceModel from "../models/workspace.model";
import RoleModel from "../models/roles-permission.model";
import { Roles } from "../enums/role.enum";
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from "../utils/appError";
import MemberModel from "../models/member.model";
import { ProviderEnum } from "../enums/account-provider.enum";

export const loginOrCreateAccountService = async (data: {
  provider: string;
  displayName: string;
  providerId: string;
  picture?: string;
  email?: string;
}) => {
  const { providerId, provider, displayName, email, picture } = data;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    console.log("🔍 Started Login or Create Account Process...");

    // Check if user exists
    let user = await UserModel.findOne({ email }).session(session);
    console.log("Existing User Check:", user);

    if (!user) {
      // Create new user if not found
      console.log("No user found, creating a new one...");
      user = new UserModel({
        email,
        name: displayName,
        profilePicture: picture || null,
      });
      await user.save({ session });
      console.log("✅ User created:", user);

      // Create account for user
      const account = new AccountModel({
        userId: user._id,
        provider: provider,
        providerId: providerId,
      });
      await account.save({ session });
      console.log("✅ Account created:", account);

      // Create workspace for new user
      const workspace = new WorkspaceModel({
        name: `My Workspace`,
        description: `Workspace created for ${user.name}`,
        owner: user._id,
      });
      await workspace.save({ session });
      console.log("✅ Workspace created:", workspace);

      // Assign OWNER role
      const ownerRole = await RoleModel.findOne({
        name: Roles.OWNER,
      }).session(session);
      if (!ownerRole) {
        console.error("❌ Owner role not found");
        throw new NotFoundException("Owner role not found");
      }

      const member = new MemberModel({
        userId: user._id,
        workspaceId: workspace._id,
        role: ownerRole._id,
        joinedAt: new Date(),
      });
      await member.save({ session });
      console.log("✅ Member added to workspace:", member);

      user.currentWorkspace = workspace._id as mongoose.Types.ObjectId;
      await user.save({ session });
      console.log("✅ User current workspace updated:", user);
    }

    await session.commitTransaction();
    session.endSession();
    console.log("🔚 End Session...");

    return { user };
  } catch (error) {
    console.error("❌ Error in login or create account process:", error);
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};


export const registerUserService = async (body: {
  email: string;
  name: string;
  password: string;
}) => {
  const { email, name, password } = body;
  const session = await mongoose.startSession();

  try {
    console.log("🔍 Started Registration Process...");

    session.startTransaction();

    // Check if user already exists
    const existingUser = await UserModel.findOne({ email }).session(session);
    console.log("Existing User Check:", existingUser);
    
    if (existingUser) {
      console.error("❌ Email already exists:", email);
      throw new BadRequestException("Email already exists");
    }

    // Create new user
    const user = new UserModel({
      email,
      name,
      password,
    });
    await user.save({ session });

    console.log("✅ New user created:", user);

    // Create new account linked to user
    const account = new AccountModel({
      userId: user._id,
      provider: ProviderEnum.EMAIL,
      providerId: email,
    });
    await account.save({ session });

    console.log("✅ Account created for user:", account);

    // Create new workspace for user
    const workspace = new WorkspaceModel({
      name: `My Workspace`,
      description: `Workspace created for ${user.name}`,
      owner: user._id,
    });
    await workspace.save({ session });

    console.log("✅ Workspace created for user:", workspace);

    // Create role and add user to workspace
    const ownerRole = await RoleModel.findOne({
      name: Roles.OWNER,
    }).session(session);

    if (!ownerRole) {
      console.error("❌ Owner role not found");
      throw new NotFoundException("Owner role not found");
    }

    const member = new MemberModel({
      userId: user._id,
      workspaceId: workspace._id,
      role: ownerRole._id,
      joinedAt: new Date(),
    });
    await member.save({ session });

    console.log("✅ Member added to workspace:", member);

    user.currentWorkspace = workspace._id as mongoose.Types.ObjectId;
    await user.save({ session });

    console.log("✅ User current workspace updated:", user);

    await session.commitTransaction();
    session.endSession();
    console.log("🔚 End Session...");

    return {
      userId: user._id,
      workspaceId: workspace._id,
    };
  } catch (error) {
    console.error("❌ Error in registration process:", error);
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const findUserByIdService = async (userId:string )=> {
  const user =await UserModel.findById(userId,{
    password:false,
  });
  return user||null;
};

export const verifyUserService = async ({
  email,
  password,
  provider = ProviderEnum.EMAIL,
}: {
  email: string;
  password: string;
  provider?: string;
}) => {
  const account = await AccountModel.findOne({ provider, providerId: email });
  if (!account) {
    throw new NotFoundException("Invalid email or password");
  }

  const user = await UserModel.findById(account.userId);

  if (!user) {
    throw new NotFoundException("User not found for the given account");
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new UnauthorizedException("Invalid email or password");
  }

  return user.omitPassword();
};
